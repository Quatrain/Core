# HOWTO: Using @quatrain/api-server-astro

This document guides you on routing API endpoints through Astro.

---

## 1. Catch-all Routing in Astro

Create a catch-all server endpoint in Astro (e.g. `src/pages/api/[...path].ts`) and bind the AstroAdapter:

```typescript
import { AstroAdapter } from '@quatrain/api-server-astro';
import { setupApiServer } from '../your-api-setup'; // Your API router configuration

const adapter = new AstroAdapter('/api');
setupApiServer(adapter);

// Export Astro APIRoute handlers
export const ALL = adapter.handle();
```

## 2. Wrapping a single handler

If you only want to wrap a single Quatrain API handler as an Astro APIRoute:

```typescript
import { AstroAdapter } from '@quatrain/api-server-astro';
import { ApiRequest, ApiResponse } from '@quatrain/api';

const myHandler = async (req: ApiRequest, res: ApiResponse) => {
   res.json({ message: 'Hello from Astro!' });
};

export const GET = AstroAdapter.wrap(myHandler);
```
