# @quatrain/backend-migrations

Database migration management tool for Quatrain backends.

## Purpose

This package is part of the Quatrain Core monorepo. It provides a system to generate, manage, and run database migrations across different backend adapters supported by Quatrain.

## HOWTO / Usage Examples

```typescript
import { MigrationManager } from '@quatrain/backend-migrations'

const manager = new MigrationManager('./migrations')
await manager.run()
```

## Conventions & Technical Details

- Follows the standard Quatrain architecture patterns.
- Ensure proper configuration before usage.
- See the root monorepo documentation for more details on building and testing this package.
