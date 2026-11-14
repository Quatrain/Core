# @quatrain/tenancy

Multi-tenancy primitives for an instance shared by several customers: who the tenants are, who
belongs to them, which tenant a request is for, and which resources serve it.

The package knows nothing about HTTP frameworks or authentication. It sits between them:

- **authentication** (`@quatrain/auth-*`) says who the user is;
- **tenancy** says which tenant the work is for and whether that user may enter it;
- **authorisation** (`@quatrain/auth-rbac`) says what the roles held in that tenant allow.

## Installation

```bash
yarn add @quatrain/tenancy
```

## Features

- **Tenant registry**: tenants with a slug, a status, free-form settings and an optional reference
  to an organisation record; memberships linking a user to a tenant with roles.
  - `TenancyRepository` stores them as ordinary Quatrain models (`Tenant`, `Membership`) through
    any backend adapter: `new TenancyRepository(new PostgresAdapter(…))`.
  - `InMemoryTenantStore` serves tests and single-process tools.
  - Both implement `TenantStoreInterface`, the port to write another store against.
- **Request resolution**: tenant read from the path (`/t/<slug>/…`), the subdomain or a header;
  resolvers can be chained.
- **Checked scopes**: a scope is granted only for an existing, active tenant and — for a user — a
  member. The actor is always explicit (`{ user }` or `{ system }`), so an unauthenticated request
  can never slip through as "no user to check".
- **Async tenant scope**: `currentTenant()` anywhere below `tenancy.run(scope, …)`, without passing
  the tenant from function to function. Opening another tenant inside a scope is refused.
- **Queue propagation**: `scopeEnvelope()` on the sending side, `scopeForEnvelope()` in the worker,
  which checks the tenant and the membership again.
- **Per-tenant resources**: `TenantResources` builds one storage client, repository or model
  adapter per tenant, lazily, and rebuilds it when the settings it is built from change. It
  replaces process-wide singletons.
- **Registry export / import** of one tenant, to move it to another instance.

## Uniqueness

Slugs, and the pair (tenant, user) of a membership, are declared `unique` on the models. Use a
backend adapter that enforces unique properties (`@quatrain/backend-postgres`,
`@quatrain/backend-sqlite`); on an adapter that ignores the option, two concurrent creations could
both succeed.

## Data isolation

This package decides who may enter a tenant; it does not isolate data by itself. Isolation is
enforced where the data lives:

- **PostgreSQL**: row-level security in `@quatrain/backend-postgres`. Give the adapter a
  `sessionSettings` function returning the tenant of the open scope, and protect each tenant-owned
  table with `rowIsolationSql()`. See [`HOWTO.md`](HOWTO.md#isolate-tenant-data-in-postgresql).
- **Files, repositories, external services**: one bucket, repository or credential per tenant,
  obtained through `TenantResources`.

## What it does not do

- It does not authenticate users nor interpret roles.
- The registry itself is not tenant-scoped: it is read before a tenant is known. Do not grant the
  application role more than `SELECT` on it where tenants are administered elsewhere.
- The export covers the registry (tenant and memberships). Files, repositories and rows are
  exported by the code that owns them.
- A tenant is never deleted, only archived: its identifier and slug are not reusable.

See [`HOWTO.md`](HOWTO.md) for usage.
