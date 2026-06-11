# How To: Using @quatrain/cloudwrapper-supabase

This guide covers specific behaviors of the Supabase wrapper.

## Table of Contents
1. [Automatic Postgres Configuration](#1-automatic-postgres-configuration)

---

## 1. Automatic Postgres Configuration

Unlike Firebase which uses a single Admin SDK, Supabase requires a Postgres connection for the backend, and an HTTP client for Storage/Auth. 

The `SupabaseWrapper` seamlessly handles this split. It creates a `PostgresAdapter` using the `connectionString` for the `@quatrain/backend`, while simultaneously configuring the `SupabaseStorageAdapter` and `SupabaseAuthAdapter` using the `url` and `key`.

```typescript
import { CloudWrapper } from '@quatrain/cloudwrapper'
import { Backend } from '@quatrain/backend'
import { Storage } from '@quatrain/storage'

// Once initialized...
const wrapper = CloudWrapper.getAdapter()

// These both work immediately:
const db = Backend.getAdapter() // Returns PostgresAdapter
const storage = Storage.getAdapter() // Returns SupabaseStorageAdapter
```
