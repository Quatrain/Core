---
type: pattern
title: RBAC & Field-Level Security
description: Role-Based Access Control and Field-Level Security (FLS) using RbacPolicyEngine and ExpressRbacMiddleware from @quatrain/auth-rbac.
tags:
  - quatrain
  - rbac
  - security
  - fls
  - authorization
timestamp: 2026-09-17T00:00:00.000Z
category: auth-and-security
status: active
---

# RBAC & Field-Level Security

Quatrain enforces granular authorization and field-level permissions using `@quatrain/auth-rbac`. Beyond coarse route guards, the engine provides Field-Level Security (FLS) to strip unauthorized properties on write (`sanitizeWrite`) and evaluate role hierarchies.

---

## 🎯 Architectural Principles

1. **Deny by Default**: Any unmapped route or action is denied unless an explicit permission or route rule grants access.
2. **Field-Level Sanitization**: Never trust client payloads directly; always pass mutations through `engine.sanitizeWrite(user, entity, payload)` to protect sensitive lineage properties (`soa`, `revision`, `role`).
3. **Framework Middleware**: Seamlessly attach route and tarpit guards to Express servers via `new ExpressRbacMiddleware(engine).handler()`.

---

## ⚖️ Implementation Patterns

### 1. Initializing RbacPolicyEngine
```typescript
import { RbacPolicyEngine } from "@quatrain/auth-rbac";
import type { RoleDefinition, RbacUserContext } from "@quatrain/auth-rbac";

const roles: RoleDefinition[] = [
  {
    id: "admin",
    name: "Administrator",
    inherits: ["editor"],
    permissions: ["*"],
  },
  {
    id: "editor",
    name: "Editor",
    inherits: ["viewer"],
    permissions: ["document:create", "document:update"],
    entities: {
      document: {
        defaultMode: "readwrite",
        fields: {
          soa: "readonly",       // Protected lineage field
          revision: "readonly",  // Protected revision stamp
          internalNotes: "hidden",
        },
      },
    },
  },
  {
    id: "viewer",
    name: "Viewer",
    permissions: ["document:read"],
  },
];

export const rbac = new RbacPolicyEngine(roles);
```

---

### 2. Field-Level Sanitization on Mutations
```typescript
import { rbac } from "./rbac";
import type { RbacUserContext } from "@quatrain/auth-rbac";

interface DocumentPayload {
  title: string;
  soa?: string;
  content: string;
}

export function sanitizeDocumentUpdate(
  user: RbacUserContext,
  rawPayload: DocumentPayload
): Partial<DocumentPayload> {
  // Strips any field marked as 'readonly' or 'hidden' for the user's active roles
  const safeData = rbac.sanitizeWrite(user, "document", rawPayload);
  return safeData;
}
```

---

### 3. Attaching Express Middleware
```typescript
import express from "express";
import { ExpressRbacMiddleware } from "@quatrain/auth-rbac";
import { rbac } from "./rbac";

const app = express();
app.use(express.json());

const rbacMiddleware = new ExpressRbacMiddleware(rbac, {
  userResolver: (req) => req.user, // User context populated by auth middleware
  enableTarpitSleep: true,
});

app.use(rbacMiddleware.handler());
```
