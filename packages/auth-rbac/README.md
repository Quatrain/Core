# @quatrain/auth-rbac

Isomorphic, framework-agnostic, and lightweight Role-Based and Attribute-Based Access Control (RBAC/ABAC) engine for Quatrain applications.

Runs seamlessly across **Node.js**, **Bun**, and the **Browser**.

---

## Features

- **Semantic Actions**: Aligned with `@quatrain/backend` operations (`create`, `read`, `update`, `delete`, `execute`, `*`).
- **Dynamic ABAC Callbacks**: Attach custom async predicate functions or scope resolvers to roles (e.g. `partner` resolving accessible tenant IDs dynamically).
- **Wildcard & Param Matching**: Supports glob wildcards (`medias/*`) and parameter segments (`companies/:cid/users`).
- **Privilege Non-Escalation Engine**: Validates whether requested scopes are a strict subset of the creator's permissions (`isSubsetOf`).
- **HTTP Resolver**: Agnostically translates HTTP verbs and routes into semantic actions and resources (`resolveHttpToSemanticAction`).
- **Zero Server Dependencies**: Completely decoupled from Express, Astro, or database adapters for maximum composability.

---

## Installation

```bash
yarn add @quatrain/auth-rbac @quatrain/types
```

---

## Quick Start

```typescript
import { RbacEngine, StandardRole } from '@quatrain/auth-rbac'

const rbac = new RbacEngine()

// 1. Register a role
rbac.registerRole({
   name: 'editor',
   inherits: [StandardRole.VISITOR],
   rules: [
      {
         action: ['read', 'create', 'update'],
         resource: 'medias/*',
      },
   ],
})

// 2. Evaluate permission
const subject = {
   uid: 'usr_123',
   role: 'editor',
}

const canEdit = await rbac.can(subject, 'update', 'medias/photo.jpg')
console.log(canEdit) // true

const canDelete = await rbac.can(subject, 'delete', 'medias/photo.jpg')
console.log(canDelete) // false
```

---

## License

AGPL-3.0-only © Quatrain Technologies
