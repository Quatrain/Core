# HOWTO: Using @quatrain/api-server

The `@quatrain/api-server` package provides agnostic HTTP endpoints (like `CrudEndpoint`, `ListEndpoint`, `ValuesEndpoint`) that can be used with any web server adapter (such as `@quatrain/api-server-express`).

## 1. Registering Endpoints

You can bind full CRUD endpoints to a specific model.

```typescript
import { CrudEndpoint, ListEndpoint } from '@quatrain/api-server';
// You must use an adapter, like ExpressAdapter from @quatrain/api-server-express
import { ExpressAdapter } from '@quatrain/api-server-express';
import { StudioModel } from '@quatrain/studio';

const server = new ExpressAdapter();

// Create a GET /api/models endpoint to list models
server.addEndpoint(
   '/api/models', 
   ListEndpoint(StudioModel)
);

// Create full POST, GET, PUT, DELETE for individual models
server.addEndpoint(
   '/api/models', 
   CrudEndpoint(StudioModel), 
   { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] }
);
```
