# @quatrain/auth-supabase

The Supabase Authentication adapter for `@quatrain/auth`.

## Introduction

Supabase Auth provides robust user management based on PostgreSQL Row Level Security. This adapter implements the Quatrain Auth interface to verify Supabase JWTs and manage user sessions.

## Installation

```bash
npm install @quatrain/auth-supabase @supabase/supabase-js
# or
yarn add @quatrain/auth-supabase @supabase/supabase-js
```

## Configuration

Initialize the adapter using your Supabase project URL and service role key.

```typescript
import { Auth } from '@quatrain/auth'
import { SupabaseAuthAdapter } from '@quatrain/auth-supabase'

const supabaseAuth = new SupabaseAuthAdapter({
    config: {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY
    }
})

Auth.addAdapter('supabase', supabaseAuth, true)
```

## License

AGPL-3.0-only
