# @quatrain/storage-local

Local filesystem storage adapter for Quatrain.

## Purpose

This package is part of the Quatrain Core monorepo. It provides a local filesystem storage adapter implementation for the Quatrain ecosystem, allowing applications to store files locally instead of relying on cloud storage providers.

## HOWTO / Usage Examples

```typescript
import { LocalStorageAdapter } from '@quatrain/storage-local'
import { Storage } from '@quatrain/storage'

Storage.registerAdapter(new LocalStorageAdapter({ path: './uploads' }))
```

## Conventions & Technical Details

- Follows the standard Quatrain architecture patterns.
- Ensure proper configuration before usage.
- See the root monorepo documentation for more details on building and testing this package.
