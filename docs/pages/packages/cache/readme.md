# @quatrain/cache

Base package defining generic caching interfaces and middlewares for the Quatrain ecosystem.

## Overview
This package is meant to be extended by specific caching implementations (e.g., `@quatrain/cache-redis`, `@quatrain/cache-memcached`). It provides:
- `CacheAdapterInterface`: The standard interface every Quatrain cache adapter must implement.
- `AbstractCacheInvalidationMiddleware`: A base class for invalidating cache namespaces following CRUD operations.
- `MediaCacheProxy`: A generic proxy layer over `@quatrain/storage` to temporarily cache binary media and provide immutable URLs.

## HOWTO

### 1. Implementing a Custom Cache Adapter
Create a new class that implements `CacheAdapterInterface`:

```typescript
import { CacheAdapterInterface } from '@quatrain/cache'

export class MyCustomCacheAdapter implements CacheAdapterInterface {
    async get(key: string): Promise<string | null> {
        // Implementation
    }
    
    async getBuffer(key: string): Promise<Buffer | null> {
        // Implementation
    }
    
    async set(key: string, value: string | Buffer, ttlSeconds?: number): Promise<void> {
        // Implementation
    }
    
    async del(...keys: string[]): Promise<void> {
        // Implementation
    }
    
    async keys(pattern: string): Promise<string[]> {
        // Implementation
    }
}
```

### 2. Using the Media Cache Proxy
Combine your adapter with a storage adapter:

```typescript
import { MediaCacheProxy } from '@quatrain/cache'
import { LocalStorageAdapter } from '@quatrain/storage-local'

const storage = new LocalStorageAdapter(...)
const myCache = new MyCustomCacheAdapter()

// Cache for 10 minutes (600s)
const proxy = new MediaCacheProxy(storage, myCache, 600)
const buffer = await proxy.getMedia({ ref: 'file.jpg' })
```
