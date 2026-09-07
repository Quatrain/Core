# @quatrain/auth-rbac

> **License**: AGPL-3.0-only  
> **Isomorphic Role-Based Access Control, Field-Level Security, M2M Agent Guards & Tarpitting for Quatrain**

`@quatrain/auth-rbac` is an isomorphic, cloud-native authorization engine designed for the Quatrain ecosystem. It provides unified, declarative access control spanning:
- **Macro-Security**: Route and endpoint protection (URI patterns + HTTP methods).
- **Micro-Security (FLS)**: Field-Level Security calculating `hidden`, `readonly`, and `readwrite` modes per entity property.
- **Automated Payload Sanitization**: `sanitizeRead()` and `sanitizeWrite()` eliminating schema duplication.
- **M2M & AI Agent Defense**: Subject-type separation (`human`, `agent`, `service`) with built-in **tarpitting** (progressive latency injection and request throttling for automated scraping and runaway agent loops).
- **Isomorphic Middlewares**: Abstract base class with concrete adapters for **Express** and **Astro SSR/API**.

---

## Installation

Within the Quatrain monorepo:

```json
{
  "dependencies": {
    "@quatrain/auth-rbac": "workspace:*"
  }
}
```

---

## Core Architecture

```
@quatrain/auth-rbac
 ├── engine/
 │    ├── RbacPolicyEngine     # Resolves role inheritance, route matching, FLS and payload sanitization
 │    └── TarpitManager        # Manages sliding-window request throttling and progressive latency injection
 ├── middlewares/
 │    ├── AbstractRbacMiddleware # Agnostic middleware foundation
 │    ├── ExpressRbacMiddleware  # Standard Express (req, res, next) guard
 │    └── AstroRbacMiddleware    # Unified Astro SSR and API guard
 └── types/                    # Strongly typed interfaces and contracts
```

---

## Quick Example

```typescript
import { RbacPolicyEngine } from '@quatrain/auth-rbac'

const engine = new RbacPolicyEngine([
  {
    id: 'curator',
    name: 'Agronomy Curator',
    routes: [
      { pattern: '/api/curate', methods: ['GET', 'POST'], access: 'allow' },
      { pattern: '/**', methods: ['*'], access: 'deny' }
    ],
    entities: {
      'okf-document': {
        defaultMode: 'readwrite',
        fields: {
          soa: 'readonly',
          internalReviewerNotes: 'hidden'
        }
      }
    }
  }
])

const user = { id: 'u1', roles: ['curator'], subjectType: 'human' }

// 1. Route check
engine.canAccessRoute(user, '/api/curate', 'POST') // true

// 2. Field mode check
engine.getFieldAccess(user, 'okf-document', 'soa') // 'readonly'
engine.getFieldAccess(user, 'okf-document', 'internalReviewerNotes') // 'hidden'

// 3. Payload sanitization
const cleanPayload = engine.sanitizeWrite(user, 'okf-document', {
  title: 'Soil Guide',
  soa: 'malicious/soa', // Stripped automatically
  internalReviewerNotes: 'Secret' // Stripped automatically
})
```
