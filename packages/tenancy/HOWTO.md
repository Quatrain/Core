# How to use @quatrain/tenancy

## Set up

```typescript
import { PostgresAdapter } from '@quatrain/backend-postgres'
import { PathTenantResolver, Tenancy, TenancyRepository } from '@quatrain/tenancy'

const store = new TenancyRepository(new PostgresAdapter({ config: { /* … */ } }))
// tests and single-process tools: new InMemoryTenantStore()

const tenancy = new Tenancy({
   store,
   resolver: new PathTenantResolver(), // /t/<slug>/…
   reservedSlugs: ['admin', 'api'],
})

const acme = await tenancy.createTenant({ slug: 'acme', name: 'Acme', settings: { bucket: 'acme-files' } })
await store.putMembership(acme.id, 'user-42', ['curator'])
```

`TenancyRepository` without argument uses the default backend (`Backend.getBackend()`).

To derive a slug from a name, use `@quatrain/identifiers`:

```typescript
import { slugify, uniqueSlug } from '@quatrain/identifiers'

const slug = await uniqueSlug(slugify(name) || 'space', async (candidate) => (await store.findTenantBySlug(candidate)) !== undefined)
```

The storage still has the last word: `createTenant` throws `TenantConflictError` if another
request took the slug in between.

## Scope a request

Call it after authentication, in the middleware of your framework.

```typescript
import { NotAMemberError, TenantNotFoundError, TenantUnavailableError } from '@quatrain/tenancy'

async function handle(request: { path: string; host?: string }, userId: string) {
   let scope
   try {
      scope = await tenancy.scopeForRequest({ path: request.path, host: request.host }, { user: userId })
   } catch (error) {
      if (error instanceof TenantNotFoundError || error instanceof TenantUnavailableError || error instanceof NotAMemberError) {
         return notFound() // same answer for all three: tenant names cannot be probed
      }
      throw error
   }
   return tenancy.run(scope, () => route(scope.path, scope.membership?.roles ?? []))
}
```

Anywhere below `tenancy.run`:

```typescript
import { currentScope, currentTenant } from '@quatrain/tenancy'

const tenant = currentTenant() // throws NoTenantScopeError outside a scope
const roles = currentScope().membership?.roles ?? []
```

## Per-tenant resources

```typescript
import { TenantResources } from '@quatrain/tenancy'

const resources = new TenantResources()

const storage = resources.define('storage', {
   create: (tenant) => new ObjectStorage({ bucket: tenant.settings.bucket as string }),
   dispose: (client) => client.close(),
   fingerprint: (tenant) => tenant.settings.bucket, // optional: rebuild only when the bucket changes
})

// Inside a scope: the storage of the current tenant.
await (await storage.get()).put('report.pdf', bytes)

// When a tenant is suspended, or at shutdown:
await resources.evict(tenant.id)
await resources.clear()
```

Without `fingerprint`, a resource is rebuilt when the status or any setting of its tenant changes.
The comparison happens when a tenant record is passed in — that of the open scope, read at each
request — so a change made by another process is picked up at the next request.

## Carry the scope through a queue

```typescript
import { scopeEnvelope } from '@quatrain/tenancy'

// Producer, inside a scope
await queue.enqueue('ingest', { scope: scopeEnvelope(), document: 'doc-7' })

// Worker
queue.listen('ingest', async (payload) => {
   const scope = await tenancy.scopeForEnvelope(payload.scope) // tenant and membership checked again
   await tenancy.run(scope, () => ingest(payload.document))
})
```

A scheduled job that belongs to no user uses a system actor:

```typescript
const scope = await tenancy.scopeForSlug('acme', { system: 'nightly-reindex' })
```

## Isolate tenant data in PostgreSQL

Tenant-owned models carry a `tenant` property holding the tenant identifier, and their tables are
protected by row-level security (see the `@quatrain/backend-postgres` how-to for the SQL side).
The adapter of the application takes the tenant from the open scope:

```typescript
import { Backend } from '@quatrain/backend'
import { PostgresAdapter, assertRowSecurityRole } from '@quatrain/backend-postgres'
import { findCurrentScope } from '@quatrain/tenancy'

const adapter = new PostgresAdapter({
   config: {
      /* host, database, restricted role… */
      sessionSettings: () => {
         const scope = findCurrentScope()
         return scope ? { 'app.tenant': scope.tenant.id } : undefined
      },
   },
})
Backend.addBackend(adapter, 'default', true)
await assertRowSecurityRole(adapter)
```

From there the ordinary repository calls made inside `tenancy.run(scope, …)` see and write the rows
of that tenant only, and the same calls made outside a scope see nothing.

```typescript
await tenancy.run(scope, async () => {
   await Document.fromObject({ name: title, tenant: currentTenant().id, title }).save()
   const mine = await Document.repository().query(query)
})
```

Migrations run with the owner role: create the registry and data tables, apply `rowIsolationSql()`
to each tenant-owned table, then grant the application role `SELECT` on `tenants`,
`tenant_memberships` and the tables referred to by object properties, and the rights it needs on
the data tables.

## Move a tenant to another instance

```typescript
const manifest = await tenancy.exportTenant(acme.id) // JSON-serialisable
await otherTenancy.importTenant(manifest) // keeps the identifier; fails if the slug or id exists
```

User identifiers are copied as they are: both instances must share the same identity provider, or
the memberships must be remapped before the import.
