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

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
