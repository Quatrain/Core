---
type: pattern
title: Auth Providers & SSO
description: Managing authentication adapters, session validation, and bearer token middlewares with @quatrain/auth.
tags:
  - quatrain
  - auth
  - sso
  - oauth
  - supabase
timestamp: 2026-09-17T00:00:00.000Z
category: auth-and-security
status: active
---

# Auth Providers & SSO

Quatrain abstracts identity providers and user authentication behind `@quatrain/auth`. The core application consumes `Auth.getProvider()`, while concrete adapters (Supabase, Firebase, Mock, Basic Auth) handle token extraction and user resolution.

---

## 🎯 Architectural Principles

1. **Provider Registration**: Adapters are registered into the global registry via `Auth.addProvider(adapter, alias, setDefault)`.
2. **Standardized Bearer Token Resolution**: Adapters implement `getAuthToken(bearer)` to parse JWTs and return the authenticated `User` model.
3. **Built-in Middleware**: Concrete adapters supply `.middleware()` returning an API middleware that automatically intercepts the `Authorization: Bearer <token>` header.

---

## ⚖️ Implementation Patterns

### 1. Registering an Auth Provider
```typescript
import { Auth } from "@quatrain/auth";
import { MockAuthAdapter } from "@quatrain/auth";

// Concrete adapter instance (e.g. SupabaseAuthAdapter, MockAuthAdapter)
const authAdapter = new MockAuthAdapter({
  alias: "default",
});

// Register into the global Auth registry
Auth.addProvider(authAdapter, "default", true);
```

---

### 2. Manual Token Verification
```typescript
import { Auth } from "@quatrain/auth";
import { User } from "@quatrain/backend";

export async function authenticateBearer(bearerToken: string): Promise<User | null> {
  const provider = Auth.getProvider(); // Default provider

  try {
    const user = await provider.getAuthToken(bearerToken);
    return user;
  } catch (err) {
    Auth.error(`Token authentication failed: ${(err as Error).message}`);
    return null;
  }
}
```
