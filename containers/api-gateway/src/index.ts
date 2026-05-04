import { extractUserIdFromAuthHeader } from './jwt'
import { getCachedPayload, setCachedPayload } from './cache'
import { handleMediaRequest } from './media'
import { Api } from '@quatrain/api'

const PORT = process.env.PORT || 3000
const API_UPSTREAM_URL = process.env.API_UPSTREAM_URL || 'http://api-express:8080'

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
    // e.g. /api/medias/123/file or /api/medias/123/thumbnail
    if (path.match(/^\/api\/medias\/[^/]+\/(file|thumbnail)$/)) {
      return handleMediaRequest(req, url)
    }

    // 2. Check if we should cache this JSON request
    const isGet = req.method === 'GET'
    const shouldBypass = BYPASS_CACHE_PATHS.some(p => path.startsWith(p))
    
    let cacheKey: string | null = null

    if (isGet && !shouldBypass) {
      const authHeader = req.headers.get('authorization')
      const userId = extractUserIdFromAuthHeader(authHeader)
      
      // cache key format: api:cache:<userId>:<pathAndQuery>
      cacheKey = `api:cache:${userId}:${url.pathname}${url.search}`
      
      const cached = await getCachedPayload(cacheKey)
      if (cached) {
        Api.info(`[API Gateway] JSON Cache HIT for ${cacheKey}`)
        return new Response(cached, {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT'
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

    const upstreamReq = new Request(targetUrl, {
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
        ttl = parseInt(match[1], 10)
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

Api.info(`🚀 API Gateway (Bun) running on port ${PORT}`)
