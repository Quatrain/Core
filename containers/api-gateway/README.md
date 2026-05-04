# @quatrain/api-gateway

## Overview

The `@quatrain/api-gateway` package is a high-performance microservice gateway developed with [Bun](https://bun.sh/). 
This component acts as a frontend to your business applications (such as `api-express`) to intercept and optimally manage:
1. **JSON Caching (Edge Caching)**: Caching of standard JSON API requests, isolated by user ID.
2. **Media Streaming (Smart Proxy)**: Optimized delivery of large binary files via S3 in "zero-copy" mode, with in-memory buffering (Redis) for thumbnails and small images.

This architecture significantly relieves the Node.js API (`api-express`), preventing it from being saturated (especially at the Event Loop level) by large file transfers.

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

## HOWTO: Configuration and Deployment

### Prerequisites
- An accessible **Redis** instance.
- The `api-express` backend configured to provide the media authentication endpoint (`GET /api/medias/:uid/auth`).

### Configuration (Environment Variables)
The application is entirely configured via these variables:
- `PORT`: Listening port for the Bun server (Default: `3000`).
- `API_UPSTREAM_URL`: Target Node.js API URL (e.g., `http://api-express:8080`).
- `REDIS_URL`: Redis connection string (e.g., `redis://redis:6379`).
- `MAX_CACHE_SIZE_MB`: Maximum size in MB for image caching (Default: `5`).

### Docker Deployment (Podman / Compose)

The component exposes its own multi-stage `ContainerFile` based on `oven/bun:alpine`.

Example of integration in `compose.yaml` (with Traefik):
```yaml
services:
  api-gateway:
    container_name: api-gateway
    image: ghcr.io/quatrain/api-gateway:latest
    restart: always
    environment:
      - PORT=3000
      - API_UPSTREAM_URL=http://api-express:8080
      - REDIS_URL=redis://redis:6379
      - MAX_CACHE_SIZE_MB=5
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api_gateway.rule=Host(`api.myproject.com`)"
      - "traefik.http.services.api_gateway.loadbalancer.server.port=3000"
```

*Note: Do not forget to disable the public Traefik labels on your `api-express`, as it should only be accessible via the Gateway (internal Docker network).*

### Cache Opt-Out
If you develop an endpoint in the `api-express` API that returns highly volatile data that should never be cached (e.g., real-time data), simply return the following header:
`Cache-Control: no-cache`
The Bun Gateway will intercept this header and ensure that the payload is never stored in Redis.
