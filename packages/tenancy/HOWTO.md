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

## Keep the secrets of a tenant

A tenant brings credentials of its own. Keep them sealed, and read them where a resource is built.

```ts
import { HashProperty } from '@quatrain/core'
import { TenantSecretRepository, TenantSecrets } from '@quatrain/tenancy'

// 32 random bytes, base64 encoded, given by the environment: `openssl rand -base64 32`
HashProperty.setDefaultKey(process.env.SECRETS_KEY)
const secrets = new TenantSecrets(new TenantSecretRepository(adapter))

await secrets.set(tenant.id, 'storage.secret', valueTypedByAnAdministrator)

const storage = resources.define('storage', {
   create: async (tenant) => new S3StorageAdapter({
      config: { ...tenant.settings.storage, secret: await secrets.get(tenant.id, 'storage.secret') },
   }),
})
```

- Sealing is done by the reversible `HashProperty` of `@quatrain/core`: the same mechanism as any
  model property holding a credential. A key can also be given to the service:
  `new TenantSecrets(store, { key })`.
- `TenantSecretRepository` stores `TenantSecret` records (collection `tenant_secrets`) through a
  backend adapter; the record only ever holds the sealed text. The port to write another store
  against is `TenantSecretStoreInterface` (`read`, `write`, `remove`, `names`).
- Never return a secret through an API: answer with `secrets.names(tenant)` or `secrets.has(…)`.
- A value copied to another tenant or name, altered, or read under another key raises
  `SecretUnreadableError`, whose message never carries the value.
- Losing the key loses the secrets: they must be typed again. Changing the key means reading every
  secret with the old key and setting it again with the new one.
