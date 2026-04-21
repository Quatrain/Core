# @quatrain/storage-supabase

The Supabase Storage adapter for `@quatrain/storage`.

## Introduction

This adapter enables file uploads and retrievals directly into Supabase Storage buckets, bridging Quatrain's API with the Supabase client.

## Installation

```bash
npm install @quatrain/storage-supabase @supabase/supabase-js
# or
yarn add @quatrain/storage-supabase @supabase/supabase-js
```

## Configuration

Initialize the adapter using your Supabase project URL and service role key.

```typescript
import { Storage } from '@quatrain/storage'
import { SupabaseStorageAdapter } from '@quatrain/storage-supabase'

const supabaseAdapter = new SupabaseStorageAdapter({
    config: {
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY
    }
})

Storage.addAdapter('supabase', supabaseAdapter, true)
```

## License

AGPL-3.0-only
