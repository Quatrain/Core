---
type: pattern
title: API Server & Endpoints
description: Standardized REST endpoint handlers and controllers with CrudEndpoint and ListEndpoint from @quatrain/api-server.
tags:
  - quatrain
  - api-server
  - endpoints
  - rest
  - controllers
timestamp: 2026-09-17T00:00:00.000Z
category: api-and-gateways
status: active
---

# API Server & Endpoints

`@quatrain/api-server` provides reusable endpoint handlers that bind Quatrain models and repositories directly to HTTP web servers (implementing `ServerAdapter` from `@quatrain/api`), automating CRUD operations and input validation.

---

## 🎯 Architectural Principles

1. **Higher-Order Endpoints**: Controllers like `CrudEndpoint(ModelClass)` return an `EndpointHandler` that attaches standardized REST routes to any `ServerAdapter`.
2. **Unified Route Registration**: Routes are mounted via `server.addEndpoint(CrudEndpoint(Model), path, options)`.
3. **Repository Integration**: Automatically invokes `Model.factory()`, `.save()`, and `.fromBackend()` under the hood.

---

## ⚖️ Implementation Patterns

### ✅ Registering CrudEndpoint on ServerAdapter
```typescript
import { CrudEndpoint } from "@quatrain/api-server";
import type { ServerAdapter } from "@quatrain/api";
import { Article } from "./models/Article";

export function registerArticleRoutes(server: ServerAdapter): void {
  // CrudEndpoint(Model) creates an EndpointHandler mapping GET, POST, PUT, DELETE
  server.addEndpoint(
    CrudEndpoint(Article),
    "/api/articles",
    {
      methods: ["CREATE", "READ", "UPDATE", "DELETE"],
    }
  );
}
```
