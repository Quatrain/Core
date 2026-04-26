# HOWTO: Working with @quatrain/api

The `@quatrain/api` package contains shared types and base classes for all API-related logic in the Quatrain framework.

## 1. Defining the API Payload
When defining custom responses or interacting with data across the network, use the `ApiPayload` interface:

```typescript
import { ApiPayload } from '@quatrain/api';

const myPayload: ApiPayload = {
   data: [
      { uid: '123', name: 'Test' }
   ],
   meta: {
      count: 1,
      offset: 0,
      batch: 10
   }
};
```

## 2. Using Endpoint Signatures
If you are building custom Server Adapters (for Express, Fastify, etc.), you should leverage the `ServerAdapter` and `EndpointHandler` interfaces to ensure consistency across the framework.
