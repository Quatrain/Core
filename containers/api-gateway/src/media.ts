import { getMediaBuffer, setMediaBuffer } from './cache'
import { Api } from '@quatrain/api'
import { extractUserIdFromAuthHeader } from './jwt'

import { API_UPSTREAM_URL, MAX_CACHE_SIZE_MB, GATEWAY_EXCLUDED_MIMES, GATEWAY_MAXSIZE, GATEWAY_CACHE_MAX_AGE, GATEWAY_CACHE_MEDIA_BY_USER } from './config'

/**
 * Handles incoming HTTP requests for media files (e.g. /api/medias/:uid/file).
 * Contacts the upstream API to authorize the request and retrieve a signed Storage URL.
 * Depending on the file size and type, it either:
 * - Redirects directly to Storage (if the MIME type is excluded or size exceeds MAX_CACHE_SIZE_MB/GATEWAY_MAXSIZE)
 * - Streams the file transparently from Storage
 * - Buffers it into Redis for subsequent fast delivery (if cacheable).
 * 
 * @param req - The incoming Fetch API Request object.
 * @param url - The parsed URL object for the incoming request.
 * @returns A promise resolving to a Fetch API Response object containing the media stream or an error message.
 */
export async function handleMediaRequest(req: Request, url: URL): Promise<Response> {
  Api.info(`[MediaProxy] Received request for ${url.pathname}`)
  const authHeader = req.headers.get('authorization')
  const tokenQuery = url.searchParams.get('token')
  const finalAuthHeader = authHeader || (tokenQuery ? `Bearer ${tokenQuery}` : '')
  
  // Extract UID and action from the path. Assuming: /blob/medias/:uid/file or /api/blob/...
  const match = url.pathname.match(/^\/?(api\/)?blob\/(.+)\/(file|thumbnail)$/)
  if (!match) {
    return new Response('Invalid media path', { status: 400 })
  }
  const uid = match[2]
  const action = match[3]

  // Default immutable caching headers for static media
  const responseHeaders = new Headers({
    'Cache-Control': `public, max-age=${GATEWAY_CACHE_MAX_AGE}, immutable`,
    'Content-Type': 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  })

  // Immediately return 204 for OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders })
  }

  // 1. Call upstream server /internal endpoint
  const authEndpoint = `${API_UPSTREAM_URL}/internal/${uid}?action=${action}`
  const gatewaySecret = process.env.GATEWAY_SECRET
  
  let authRes: Response
  try {
    authRes = await fetch(authEndpoint, {
      headers: { 
        'X-Gateway-Secret': gatewaySecret || '',
        'Authorization': finalAuthHeader
      }
    })
  } catch (err) {
    Api.error(`[MediaProxy] Failed to contact upstream internal API:`, err)
    return new Response('Gateway Error', { status: 502 })
  }

  if (!authRes.ok) {
    // Return the upstream's error (e.g. 403 Forbidden)
    return new Response(authRes.body, { status: authRes.status, headers: authRes.headers })
  }

  const mediaInfo = (await authRes.json()) as {
    url?: string
    mimeType?: string
    size?: number
  }
  const storageUrl = mediaInfo.url
  let mimeType = mediaInfo.mimeType || 'application/octet-stream'
  let size = mediaInfo.size || 0

  if (!storageUrl) {
    return new Response('No media URL provided by API', { status: 404 })
  }

  // If the internal API returns a size of 0 (common for dynamically generated thumbnails or missing metadata),
  // proactively perform a lightweight HEAD request directly to the storage bucket.
  // This accurately populates content-length for proper cache sizing and content-type verification.
  if (size === 0) {
    try {
      const headRes = await fetch(storageUrl, { method: 'HEAD' })
      const cl = headRes.headers.get('content-length')
      if (cl) size = Number.parseInt(cl, 10)
      
      const ct = headRes.headers.get('content-type')
      if (ct) mimeType = ct
    } catch (err) {
      Api.debug(`[MediaProxy] Failed to HEAD storage URL for exact size:`, err)
    }
  }

  // 1.5. Check Excluded Mimes and Size
  const sizeMB = (size / (1024 * 1024)).toFixed(2)
  
  if (GATEWAY_EXCLUDED_MIMES.includes(mimeType)) {
    Api.info(`[MediaProxy] Strategy: REDIRECTION | Reason: Excluded MIME (${mimeType}) | Size: ${sizeMB} MB`)
    return Response.redirect(storageUrl, 302)
  }
  
  if (GATEWAY_MAXSIZE !== null && size > GATEWAY_MAXSIZE) {
    const maxSizeMB = (GATEWAY_MAXSIZE / (1024 * 1024)).toFixed(2)
    Api.info(`[MediaProxy] Strategy: REDIRECTION | Reason: Size exceeds GATEWAY_MAXSIZE (${sizeMB} MB > ${maxSizeMB} MB)`)
    return Response.redirect(storageUrl, 302)
  }

  const isImage = mimeType.startsWith('image/')
  const shouldCache = isImage && (size / (1024 * 1024)) <= MAX_CACHE_SIZE_MB

  Api.info(`[MediaProxy] Strategy: STREAMING | Size: ${sizeMB} MB | MIME: ${mimeType} | Caching: ${shouldCache}`)

  // Update response content type from metadata
  responseHeaders.set('Content-Type', mimeType)

  // 2. Fetch from Storage (with Redis cache if applicable)
  let cacheKey = `media:${uid}:${action}`
  
  if (GATEWAY_CACHE_MEDIA_BY_USER) {
    const userId = extractUserIdFromAuthHeader(finalAuthHeader) || 'anonymous'
    cacheKey = `media:${userId}:${uid}:${action}`
  }

  if (shouldCache) {
    // Try to get from Redis
    const cachedBuffer = await getMediaBuffer(cacheKey)
    if (cachedBuffer) {
      Api.info(`[MediaProxy] Cache HIT for ${cacheKey}`)
      return new Response(cachedBuffer, { headers: responseHeaders })
    }
  }

  Api.info(`[MediaProxy] Proxying stream from Storage for ${uid} (cache=${shouldCache})`)
  
  let storageRes: Response
  try {
    storageRes = await fetch(storageUrl)
  } catch (err) {
    Api.error(`[MediaProxy] Failed to fetch from Storage:`, err)
    return new Response('Failed to download media', { status: 502 })
  }

  if (!storageRes.ok) {
    // S3 and similar storages return 403 Forbidden instead of 404 Not Found when a file doesn't exist
    // on a bucket configured without `s3:ListBucket` permissions.
    // Since upstream validation already passed, a 403 here strictly means the file is missing.
    const status = storageRes.status === 403 ? 404 : storageRes.status
    return new Response('Storage Error or Not Found', { status })
  }

  if (shouldCache) {
    // To cache it, we must read it into a buffer
    const arrayBuffer = await storageRes.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Save to Redis asynchronously
    setMediaBuffer(cacheKey, buffer, GATEWAY_CACHE_MAX_AGE)
    
    return new Response(buffer, { headers: responseHeaders })
  }

  // 3. Direct Streaming (Zero-Copy-ish)
  // Bun optimizes streaming Responses heavily.
  return new Response(storageRes.body, { headers: responseHeaders })
}
