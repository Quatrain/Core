import { getMediaBuffer, setMediaBuffer } from './cache'
import { Api } from '@quatrain/api'

const API_UPSTREAM_URL = process.env.API_UPSTREAM_URL || 'http://api-express:8080'
const MAX_CACHE_SIZE_MB = parseInt(process.env.MAX_CACHE_SIZE_MB || '5', 10)

/**
 * Handles incoming HTTP requests for media files (e.g. /api/medias/:uid/file).
 * Contacts the upstream API to authorize the request and retrieve a signed S3 URL.
 * Depending on the file size and type, it either streams the file directly from S3
 * or buffers it into Redis for subsequent fast delivery.
 * 
 * @param req - The incoming Fetch API Request object.
 * @param url - The parsed URL object for the incoming request.
 * @returns A promise resolving to a Fetch API Response object containing the media stream or an error message.
 */
export async function handleMediaRequest(req: Request, url: URL): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  
  // Extract UID and action from the path. Assuming: /api/medias/:uid/file
  // Parts: ['', 'api', 'medias', 'UID', 'ACTION']
  const pathParts = url.pathname.split('/')
  const uid = pathParts[3]
  const action = pathParts[4] || 'file'

  if (!uid) {
    return new Response('Missing UID', { status: 400 })
  }

  // 1. Call api-express /auth endpoint
  const authEndpoint = `${API_UPSTREAM_URL}/api/medias/${uid}/auth?action=${action}`
  
  let authRes: Response
  try {
    authRes = await fetch(authEndpoint, {
      headers: authHeader ? { 'Authorization': authHeader } : {}
    })
  } catch (err) {
    Api.error(`[MediaProxy] Failed to contact upstream auth API:`, err)
    return new Response('Gateway Error', { status: 502 })
  }

  if (!authRes.ok) {
    // Return the upstream's error (e.g. 403 Forbidden)
    return new Response(authRes.body, { status: authRes.status, headers: authRes.headers })
  }

  const mediaInfo = await authRes.json()
  const s3Url = mediaInfo.url
  const mimeType = mediaInfo.mimeType || 'application/octet-stream'
  const size = mediaInfo.size || 0

  if (!s3Url) {
    return new Response('No media URL provided by API', { status: 404 })
  }

  const isImage = mimeType.startsWith('image/')
  const sizeMB = size / (1024 * 1024)
  const shouldCache = isImage && sizeMB <= MAX_CACHE_SIZE_MB

  // Default immutable caching headers for static media
  const responseHeaders = new Headers({
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': mimeType
  })

  // 2. Fetch from S3 (with Redis cache if applicable)
  const cacheKey = `media:${uid}:${action}`

  if (shouldCache) {
    // Try to get from Redis
    const cachedBuffer = await getMediaBuffer(cacheKey)
    if (cachedBuffer) {
      Api.info(`[MediaProxy] Cache HIT for ${cacheKey}`)
      return new Response(cachedBuffer, { headers: responseHeaders })
    }
  }

  Api.info(`[MediaProxy] Proxying stream from S3 for ${uid} (cache=${shouldCache})`)
  
  let s3Res: Response
  try {
    s3Res = await fetch(s3Url)
  } catch (err) {
    Api.error(`[MediaProxy] Failed to fetch from S3:`, err)
    return new Response('Failed to download media', { status: 502 })
  }

  if (!s3Res.ok) {
    return new Response('S3 Error', { status: s3Res.status })
  }

  if (shouldCache) {
    // To cache it, we must read it into a buffer
    const arrayBuffer = await s3Res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Save to Redis asynchronously
    setMediaBuffer(cacheKey, buffer, 31536000) // cache for 1 year
    
    return new Response(buffer, { headers: responseHeaders })
  }

  // 3. Direct Streaming (Zero-Copy-ish)
  // Bun optimizes streaming Responses heavily.
  return new Response(s3Res.body, { headers: responseHeaders })
}
