# @quatrain/cache-redis

A dedicated Redis integration package for the Quatrain ecosystem. 

## Overview
This package provides a standardized `RedisManager` along with specialized services and middlewares to handle caching and invalidation using Redis.

## Features
- **RedisManager**: A singleton wrapper around `ioredis` that provides a standardized client.
- **RedisCacheInvalidationMiddleware**: A Quatrain `BackendMiddleware` that intercepts successful backend mutations (`afterExecute`) to invalidate specific cache namespaces matching the collection being modified.
- **RedisMediaCache**: A proxy layer over any `@quatrain/storage` `StorageAdapter` designed to cache media files. It caches binary files into Redis with a short TTL, providing a stable immutable source that an API can stream to clients with permanent `Cache-Control` headers.
- **Docker Compose snippet**: A ready-to-use `docker-compose.redis.yml` is provided in the repository root for local development.

## HOWTO

### 1. Spinning up a Local Redis
Run the provided Docker composition from within the package directory:
```bash
docker-compose -f docker-compose.redis.yml up -d
```

### 2. Using the Cache Invalidation Middleware
```typescript
import { Backend } from '@quatrain/backend'
import { SQLiteAdapter } from '@quatrain/backend-sqlite'
import { RedisManager, RedisCacheInvalidationMiddleware } from '@quatrain/cache-redis'

const redis = RedisManager.getInstance('redis://localhost:6379')
const invalidationMiddleware = new RedisCacheInvalidationMiddleware(redis, 'my-namespace')

const sqlite = new SQLiteAdapter(...)
sqlite.addMiddleware(invalidationMiddleware)

Backend.init(sqlite)

// Now, every time Backend.create, Backend.update, or Backend.delete is called,
// the middleware will run AFTER the commit and execute `DEL my-namespace:collectionName:*`
```

### 3. Using the Redis Media Cache
```typescript
import { LocalStorageAdapter } from '@quatrain/storage-local'
import { RedisManager, RedisMediaCache } from '@quatrain/cache-redis'

const storage = new LocalStorageAdapter(...)
const redis = RedisManager.getInstance()

// Cache binaries for 10 minutes (600s)
const mediaCache = new RedisMediaCache(storage, redis, 600)

// Fetching a media file directly buffers it from Redis if available,
// or falls back to downloading via the StorageAdapter and storing it in Redis.
const buffer = await mediaCache.getMedia({ ref: 'my-file.jpg' })
```
