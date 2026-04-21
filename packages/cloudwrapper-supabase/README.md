# @quatrain/cloudwrapper-supabase

The Supabase ecosystem wrapper for `@quatrain/cloudwrapper`.

## Introduction

This package aggregates the initialization of:
- `@quatrain/backend-postgres` (Supabase uses standard Postgres)
- `@quatrain/storage-supabase`
- `@quatrain/auth-supabase`

It provides a single configuration entry point to connect your entire Quatrain application to your Supabase project.

## Installation

```bash
npm install @quatrain/cloudwrapper-supabase @supabase/supabase-js pg
# or
yarn add @quatrain/cloudwrapper-supabase @supabase/supabase-js pg
```

## Configuration

Initialize the wrapper using your Supabase project URL, service role key, and database connection string.

```typescript
import { CloudWrapper } from '@quatrain/cloudwrapper'
import { SupabaseWrapper } from '@quatrain/cloudwrapper-supabase'

const supabaseEnv = new SupabaseWrapper({
    config: {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        connectionString: process.env.SUPABASE_DB_URL
    }
})

CloudWrapper.addAdapter('supabase', supabaseEnv, true)
```

## License

AGPL-3.0-only
