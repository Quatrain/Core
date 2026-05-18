# HOWTO: API Gateway Usage and Configuration

This guide provides practical examples of how to configure and deploy the `@quatrain/api-gateway`.

## 1. Environment Configuration

To run the gateway, you need to provide several environment variables. You can copy the provided `.env.dist` file to `.env` to get started:

```bash
cp .env.dist .env
```

### Key Configuration Variables

- **`GATEWAY_SECRET`**: A shared secret between the gateway and the `api-express` upstream. This is required to authorize the gateway's internal requests to the API.
- **`GATEWAY_CACHE_API_BY_USER`**: (Default `true`) When `true`, JSON responses are cached individually per user by extracting their ID from the JWT token. Set to `false` for a global cache shared across all users.
- **`GATEWAY_CACHE_MEDIA_BY_USER`**: (Default `true`) When `true`, media blobs (images, etc.) are cached individually per user. Useful when media has restricted access lists.
- **`GATEWAY_MAXSIZE`**: Files exceeding this size (in bytes) will not be streamed through the gateway. Instead, a `302 Redirect` to the underlying S3/Storage bucket URL is returned to the client.
- **`GATEWAY_EXCLUDED_MIMES`**: A comma-separated list of MIME types (e.g., `application/pdf`) that should never be proxied/streamed and should immediately return a `302 Redirect` to the client.

## 2. Setting Up in Docker / Podman

The API Gateway is meant to be run in front of the `api-express` container. 

Here is a typical `compose.yaml` configuration:

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
      - GATEWAY_SECRET=${GATEWAY_SECRET}
      - GATEWAY_CACHE_API_BY_USER=true
      - GATEWAY_CACHE_MEDIA_BY_USER=true
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api_gateway.rule=Host(`api.example.com`)"
      - "traefik.http.services.api_gateway.loadbalancer.server.port=3000"
```

> **Warning:** Ensure that your `api-express` container is NOT exposed directly through Traefik or your reverse proxy. Only the `api-gateway` should receive external traffic.

## 3. Disabling Cache from the Upstream API

If you have an endpoint in your `api-express` backend that returns highly volatile data and should never be cached, simply return the standard HTTP `Cache-Control` header:

```typescript
res.setHeader('Cache-Control', 'no-cache')
res.json({ data: 'volatile data' })
```

The gateway parses this header and will ensure the response is served directly to the user without being stored in Redis.
