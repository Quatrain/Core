# @quatrain/auth-pocketbase

PocketBase Authentication adapter for Quatrain.

## Purpose

This package is part of the Quatrain Core monorepo. It provides a PocketBase authentication adapter for the Quatrain ecosystem, enabling seamless integration with PocketBase backends.

## HOWTO / Usage Examples

```typescript
import { PocketBaseAuthAdapter } from '@quatrain/auth-pocketbase'
import { Auth } from '@quatrain/auth'

Auth.registerAdapter(new PocketBaseAuthAdapter('http://localhost:8090'))
```

## Conventions & Technical Details

- Follows the standard Quatrain architecture patterns.
- Ensure proper configuration before usage.
- See the root monorepo documentation for more details on building and testing this package.
