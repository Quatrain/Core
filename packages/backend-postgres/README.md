# @quatrain/backend-postgres

A backend adapter for PostgreSQL. This package is optimized for use with Supabase but works with any standard PostgreSQL database.

## Features

- Implements the `@quatrain/backend` abstract adapter.
- Full SQL support for complex queries, transactions, and joins.
- Uses the `pg` (node-postgres) library for high performance.
- Includes scripts and guidance for setting up the required database schema.

## Installation

```bash
npm install @quatrain/backend-postgres pg
```

## Usage

```typescript
import { Backend } from '@quatrain/backend'
import { PostgresAdapter } from '@quatrain/backend-postgres'

const adapter = new PostgresAdapter({ config: { connectionString: '...' } })
Backend.addAdapter(adapter, 'default', true)
```

## Timezone Handling

All `TIMESTAMP WITHOUT TIME ZONE` values are interpreted as UTC. The adapter configures the `pg` driver's type parsers to return timestamps as ISO8601 strings with the `Z` suffix, ensuring consistent timezone handling regardless of the server's local timezone.

This means:

- Timestamps stored in the database (e.g., `2026-02-06 08:24:06.034`) are treated as UTC
- The adapter returns them as `2026-02-06T08:24:06.034Z` for proper parsing
- Frontend applications can then convert to the user's local timezone for display

## Row isolation (multi-tenant data)

The adapter can restrict each statement to the rows of one owner — typically a tenant — with
PostgreSQL row-level security, so a forgotten filter cannot leak another owner's data.

- `config.sessionSettings`: a function called before each statement and returning settings such as
  `{ 'app.tenant': '…' }`, or `undefined`. They are applied for one transaction only, so pooled
  connections never keep them.
- `rowIsolationSql(table, options?)`: DDL that enables and forces row-level security on a table and
  compares its owner column (default `tenant`) with the setting (default `app.tenant`).
- `assertRowSecurityRole(adapter)`: start-up check that the role does not bypass policies.

Without an owner, protected tables look empty and refuse writes. Limits to know:

- superusers and roles with `BYPASSRLS` ignore every policy: connect the application with an
  ordinary role and keep the owner role for migrations;
- such a role cannot create tables, so the adapter's automatic table creation does not apply:
  create the tables (and those their object properties refer to, e.g. the users table) with
  migrations, and grant the role `SELECT` on the referred tables;
- each statement then costs a transaction (three extra round trips).

See the [How-To Guide](HOWTO.md#row-isolation).

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
