# HOWTO: Using @quatrain/api-server-express

The `@quatrain/api-server-express` package allows you to expose your Quatrain models over HTTP instantly using an `ExpressAdapter`.

## 1. Setting up the Express Adapter

Initialize the `ExpressAdapter` and pass any standard Express middlewares (like CORS or JSON parsers).

```typescript
import { ExpressAdapter } from '@quatrain/api-server-express';

const server = new ExpressAdapter();
```

## 2. Registering Endpoints

You can bind full CRUD endpoints to a specific model. Note that endpoints are imported from `@quatrain/api-server`!

```typescript
import { CrudEndpoint, ListEndpoint } from '@quatrain/api-server';
import { ExpressAdapter } from '@quatrain/api-server-express';
import { StudioModel } from '@quatrain/studio';
import { Api } from '@quatrain/api';

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

## 3. Starting the Server

```typescript
const PORT = 4000;
server.start(PORT, () => {
   Api.info(`Server listening on port ${PORT}`);
});
```
