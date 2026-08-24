# How-To & Integration Guide : @quatrain/auth-rbac

This guide demonstrates common integration scenarios using `@quatrain/auth-rbac` across Astro, Express, and headless controllers.

---

## 1. Defining Roles & Tarpit Policies

Declare role hierarchies, entity field rules, and M2M agent tarpit limits:

```typescript
import { RbacPolicyEngine, type RoleDefinition } from '@quatrain/auth-rbac'

export const appRoles: RoleDefinition[] = [
  {
    id: 'reader',
    name: 'Reader',
    routes: [
      { pattern: '/api/curate', methods: ['GET'], access: 'allow' },
      { pattern: '/public/**', methods: ['*'], access: 'allow' },
      { pattern: '/**', methods: ['*'], access: 'deny' }
    ],
    entities: {
      'okf-document': {
        defaultMode: 'readonly',
        fields: {
          internalNotes: 'hidden',
          rawLogs: 'hidden'
        }
      }
    }
  },
  {
    id: 'curator',
    name: 'Curator',
    inherits: ['reader'],
    routes: [
      { pattern: '/api/curate', methods: ['POST', 'PUT'], access: 'allow' },
      { pattern: '/api/upload', methods: ['POST'], access: 'allow' }
    ],
    entities: {
      'okf-document': {
        defaultMode: 'readwrite',
        fields: {
          soa: 'readonly',
          revision: 'readonly',
          internalNotes: 'hidden'
        }
      }
    }
  },
  {
    id: 'ai-agent',
    name: 'AI Agent Service',
    subjectTypes: ['agent', 'service'],
    routes: [
      { pattern: '/api/agent/**', methods: ['POST'], access: 'allow' }
    ],
    tarpit: {
      enabled: true,
      burst: 5,
      maxRequestsPerMinute: 30,
      delayMs: 500,
      blockDurationMs: 60000 // 1 minute temporary lock on abuse
    }
  }
]

export const rbacEngine = new RbacPolicyEngine(appRoles)
```

---

## 2. Using with Astro (SSR & API Middlewares)

In `src/middleware.ts` of your Astro application:

```typescript
import { sequence } from 'astro:middleware'
import { AstroRbacMiddleware } from '@quatrain/auth-rbac'
import { rbacEngine } from './lib/rbac'

const rbacMiddleware = new AstroRbacMiddleware(rbacEngine, {
  loginRedirectPath: '/login',
  forbiddenRedirectPath: '/403',
  enableTarpitSleep: true
})

export const onRequest = sequence(
  // Your auth session middleware setting context.locals.user ...
  rbacMiddleware.handler()
)
```

Inside an Astro API endpoint (`src/pages/api/curate.ts`):

```typescript
import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request, locals }) => {
  const rbac = locals.rbac // Injected automatically
  const body = await request.json()

  // 1. Sanitize incoming write payload against curator role
  const safeData = rbac.sanitizeWrite('okf-document', body)

  // 2. Persist to storage / database
  const savedItem = await documentService.save(safeData)

  // 3. Sanitize outgoing read payload
  const clientResponse = rbac.sanitizeRead('okf-document', savedItem)

  return new Response(JSON.stringify(clientResponse), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

---

## 3. Using with Express

```typescript
import express from 'express'
import { ExpressRbacMiddleware } from '@quatrain/auth-rbac'
import { rbacEngine } from './lib/rbac'

const app = express()
const rbacMiddleware = new ExpressRbacMiddleware(rbacEngine)

app.use(express.json())
app.use(rbacMiddleware.handler())

app.post('/api/curate', (req, res) => {
  const safeInput = req.rbac.sanitizeWrite('okf-document', req.body)
  // ... process safeInput
  res.json(req.rbac.sanitizeRead('okf-document', safeInput))
})
```
