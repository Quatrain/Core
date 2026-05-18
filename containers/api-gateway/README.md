# @quatrain/api-gateway

## Overview

The `@quatrain/api-gateway` package is a high-performance microservice gateway developed with [Bun](https://bun.sh/). 
This component acts as a frontend to your business applications to intercept and optimally manage:
1. **JSON Caching (Edge Caching)**: Caching of standard JSON API requests, isolated by user ID.
2. **Media Streaming (Smart Proxy)**: Optimized delivery of large binary files via S3 in "zero-copy" mode, with in-memory buffering (Redis) for thumbnails and small images.

This architecture significantly relieves the Node.js API, preventing it from being saturated (especially at the Event Loop level) by large file transfers.

---

## Detailed Architecture

### 1. JSON Request Caching
The Gateway intercepts `GET` requests. It reads the `Authorization` header (Bearer Token) to decode the JWT (without verifying the cryptographic signature, which is delegated to the internal API) in order to extract the user's ID (`sub` or `uid`).

It then generates a Redis cache key specific to this user:
`api:cache:<USER_ID>:<URL_PATH>`

If the key exists, the Gateway returns the JSON directly without contacting the API (Cache Hit). 
Otherwise, the request is forwarded to the API (`api-express`). If the API returns a 200 OK (without `Cache-Control: no-cache`), the response is stored in Redis.

**Invalidation:** The `api-express` API (via the `CacheInvalidateMiddleware` from `@quatrain/cache`) automatically purges these Redis keys (`DEL *:collection*`) upon any modification (POST, PATCH, DELETE).

### 2. Media Streaming (Smart Proxy)
When the Gateway detects a media request (e.g., `/api/medias/123/file`), it applies an asynchronous proxy logic:
1. **Access Verification**: It makes an ultra-fast internal request to the `/auth` endpoint of the Node.js API.
2. **Obtaining the Signed URL**: The API verifies the rights in the database, generates a local Signed URL (S3/Supabase), and returns it with metadata (size, MIME type).
3. **Cache/Stream Strategy**:
   - **Images under 5 MB**: The Gateway downloads the file from S3, stores it in the Redis cache as a binary Buffer, and streams it to the client (with a 1-year `Cache-Control: immutable` header). Subsequent requests for this image will be served from Redis RAM in a few milliseconds.
   - **Large files (> 5 MB or Videos)**: The Gateway uses Bun's streaming power to transfer the file directly from S3 to the client in "zero-copy" mode (native Stream), without consuming Redis memory or Node.js API CPU.

---

## Documentation

For full configuration variables and practical usage instructions, please refer to the [HOWTO.md](./HOWTO.md) file.
You can also find all supported environment variables with their descriptions in the [.env.dist](./.env.dist) file.
