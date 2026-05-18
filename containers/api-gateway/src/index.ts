import { extractUserIdFromAuthHeader } from './jwt'
import { getCachedPayload, setCachedPayload, invalidateResourceCache } from './cache'
import { handleMediaRequest } from './media'
import { Api } from '@quatrain/api'
import { readFileSync } from 'fs'
import pkg from '../package.json'

import { PORT, API_UPSTREAM_URL, GATEWAY_CACHE_API_BY_USER } from './config'

// Endpoints that bypass JSON caching entirely (can be expanded)
const BYPASS_CACHE_PATHS = [
  '/api/health',
  '/api/medias/' // Media has its own proxy handler
]

Bun.serve({
  port: PORT,
  
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

    // 1. Media Routing
    // e.g. /blob/medias/123/file or /api/blob/videos/123/thumbnail
    if (path.match(/^\/?(api\/)?blob\/(.+)\/(file|thumbnail)$/)) {
      return handleMediaRequest(req, url)
    }

    // 2. Check if we should cache this JSON request
    const isGet = req.method === 'GET'
    const shouldBypass = BYPASS_CACHE_PATHS.some(p => path.startsWith(p))
    
    let cacheKey: string | null = null

    if (isGet && !shouldBypass) {
      const authHeader = req.headers.get('authorization')
      const userId = extractUserIdFromAuthHeader(authHeader)
      
      // cache key format: api:cache:<userIdOrGlobal>:<pathAndQuery>
      const cacheScope = GATEWAY_CACHE_API_BY_USER ? userId : 'global'
      cacheKey = `api:cache:${cacheScope}:${url.pathname}${url.search}`
      
      const cached = await getCachedPayload(cacheKey)
      if (cached) {
        Api.info(`[API Gateway] JSON Cache HIT for ${cacheKey}`)
        return new Response(cached, {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*'
          }
        })
      }
    }

    // 3. Proxy to Upstream
    Api.info(`[API Gateway] Proxying to upstream: ${req.method} ${path}`)
    
    // Rewrite URL to target upstream
    const targetUrl = new URL(url.pathname + url.search, API_UPSTREAM_URL)
    
    // Copy original headers
    const headers = new Headers(req.headers)
    // Avoid upstream gzip so we can cache raw string easily (optional, but safer)
    headers.delete('accept-encoding') 

    // Convert URL object to string to satisfy strict TypeScript DOM typings for Request constructor
    const upstreamReq = new Request(targetUrl.toString(), {
      method: req.method,
      headers: headers,
      body: req.body,
      redirect: 'manual'
    })

    let upstreamRes: Response
    try {
      upstreamRes = await fetch(upstreamReq)
    } catch (err) {
      Api.error(`[API Gateway] Upstream error:`, err)
      return new Response('Bad Gateway', { status: 502 })
    }

    // Invalidate global resource cache on successful data mutations (POST, PUT, PATCH, DELETE).
    // This explicitly prevents cache invalidation on non-mutating preflight requests (OPTIONS) or HEAD.
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    if (isMutation && upstreamRes.ok) {
      // We do this asynchronously to avoid blocking the response
      invalidateResourceCache(path)
    }

    // 4. Cache the response if applicable
    // We only cache 200 OK JSON responses that don't have "no-cache"
    const cacheControl = upstreamRes.headers.get('cache-control') || ''
    const isCacheable = cacheKey && 
                        upstreamRes.status === 200 && 
                        !cacheControl.includes('no-cache') &&
                        !cacheControl.includes('no-store')

    if (isCacheable) {
      // Read response text to cache it
      const responseText = await upstreamRes.text()
      
      // Extract custom TTL from max-age if present, else default to 1h
      let ttl = 3600
      const match = cacheControl.match(/max-age=(\d+)/)
      if (match) {
        ttl = Number.parseInt(match[1], 10)
      }
      
      await setCachedPayload(cacheKey, responseText, ttl)

      // Reconstruct response since we consumed the body
      const newHeaders = new Headers(upstreamRes.headers)
      newHeaders.set('X-Cache', 'MISS')
      
      return new Response(responseText, {
        status: upstreamRes.status,
        headers: newHeaders
      })
    }

    // Return stream directly if not caching
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: upstreamRes.headers
    })
  }
})

let buildDate = 'Unknown Date'
try {
  buildDate = readFileSync('./dist/build_date.txt', 'utf-8').trim()
} catch (e) {
  // Ignore if file doesn't exist (e.g. during local dev)
}

Api.info(`🚀 API Gateway (Bun) v${pkg.version} running on port ${PORT} (Built: ${buildDate})`)

const gatewaySecret = process.env.GATEWAY_SECRET
if (gatewaySecret) {
  Api.info(`[API Gateway] GATEWAY_SECRET is configured (length: ${gatewaySecret.length})`)
} else {
  Api.warn(`[API Gateway] GATEWAY_SECRET is NOT configured! Internal requests may fail.`)
}
