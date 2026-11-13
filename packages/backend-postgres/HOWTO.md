# How to use @quatrain/backend-postgres

## Unique properties

Declare the property `unique` in the model; the adapter creates the column with a `UNIQUE`
constraint and reports a collision as a `UniqueConstraintError`.

```typescript
import { PersistedBaseObject, UniqueConstraintError } from '@quatrain/backend'
import { BaseObjectProperties, StringProperty } from '@quatrain/core'

class Space extends PersistedBaseObject {
   static COLLECTION = 'spaces'
   static PROPS_DEFINITION = [...BaseObjectProperties, { name: 'slug', type: StringProperty.TYPE, unique: true }]
}

try {
   await Space.fromObject({ name: 'Acme', slug: 'acme' }).save()
} catch (error) {
   if (error instanceof UniqueConstraintError) {
      // error.collection === 'spaces', error.property === 'slug'
   }
}
```

A table that already exists is not altered: add the constraint with a migration
(`ALTER TABLE spaces ADD CONSTRAINT spaces_slug_key UNIQUE (slug)`). Keep that constraint name,
`<table>_<column>_key`: the adapter uses it to tell which property collided.

## Row isolation

Use it when one database holds the data of several owners (tenants) that must never see each
other's rows.

### 1. Protect the tables (migration, owner role)

Each protected table needs a column naming the owner of the row — here a `tenant` property.

```typescript
import { rowIsolationSql } from '@quatrain/backend-postgres'

await ownerAdapter.rawQuery(rowIsolationSql('documents'))
// other names: rowIsolationSql('notes', { column: 'owner', setting: 'acl.owner' })
```

Index the owner column: the policy adds it to every query.

### 2. Connect the application with an ordinary role

```sql
CREATE ROLE app LOGIN PASSWORD '…';
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO app;
GRANT SELECT ON "user" TO app; -- tables that object properties refer to
```

### 3. Tell the adapter who the current owner is

```typescript
import { AsyncLocalStorage } from 'node:async_hooks'
import { Backend } from '@quatrain/backend'
import { PostgresAdapter, assertRowSecurityRole } from '@quatrain/backend-postgres'

const currentTenant = new AsyncLocalStorage<string>()

const adapter = new PostgresAdapter({
   config: {
      host: 'db.example.org',
      database: 'app',
      user: 'app',
      password: process.env.DATABASE_PASSWORD,
      sessionSettings: () => {
         const tenant = currentTenant.getStore()
         return tenant === undefined ? undefined : { 'app.tenant': tenant }
      },
   },
})
Backend.addBackend(adapter, 'default', true)

await assertRowSecurityRole(adapter) // throws if the role is a superuser or has BYPASSRLS
```

### 4. Run the work of a request inside its owner

```typescript
await currentTenant.run(tenantId, async () => {
   const documents = await Document.repository().query(query) // rows of this tenant only
})
```

Records must be created with their owner column set to the current owner; the policy refuses any
other value. Outside `currentTenant.run`, protected tables look empty and refuse writes.
