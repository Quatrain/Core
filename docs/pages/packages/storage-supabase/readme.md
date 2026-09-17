# @quatrain/storage-supabase

> 📦 **API Reference**: Detailed TypeScript documentation, classes, interfaces, and methods are available in the [TypeDoc API Reference for @quatrain/storage-supabase ↗](/api-reference/modules/_quatrain_storage-supabase.html).

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

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
