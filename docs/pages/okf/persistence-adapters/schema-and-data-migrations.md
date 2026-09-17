---
type: pattern
title: Schema & Data Migrations
description: Versioned schema evolution and data migrations using MigrationManager from @quatrain/backend-migrations.
tags:
  - quatrain
  - backend
  - migrations
  - ddl
  - schema
timestamp: 2026-09-17T00:00:00.000Z
category: persistence-adapters
status: active
---

# Schema & Data Migrations

Quatrain applications manage database schema evolution and migrations using `MigrationManager` from `@quatrain/backend-migrations`. Powered by Umzug, migrations are executed against the active backend adapter with automatic tracking in `QuatrainMigrationStorage`.

---

## 🎯 Architectural Principles

1. **Adapter-Bound Migrations**: `MigrationManager` accepts an instantiated `AbstractBackendAdapter` (e.g. from `Backend.getBackend()`).
2. **Directory Isolation**: Migrations are scoped per backend alias under `data/migrations/<alias>/` or an explicit `migrationsPath`.
3. **Automated Verification**: Migration status can be audited via `getPendingMigrations()` prior to deployment.

---

## ⚖️ Implementation Patterns

### ✅ Running Pending Migrations
```typescript
import { MigrationManager } from "@quatrain/backend-migrations";
import { Backend } from "@quatrain/backend";

export async function runDatabaseMigrations(): Promise<void> {
  const adapter = Backend.getBackend(); // Get active default adapter

  const manager = new MigrationManager(adapter, {
    migrationsPath: "./data/migrations/default",
  });

  // Check pending migrations
  const pending = await manager.getPendingMigrations();
  console.log(`Discovered ${pending.length} pending migration(s)`);

  if (pending.length > 0) {
    // Execute all pending migrations
    await manager.executeMigrations();
    console.log("All migrations executed successfully.");
  }
}
```
