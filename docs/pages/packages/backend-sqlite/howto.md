# How To: Using @quatrain/backend-sqlite

This guide explains how to use the SQLite adapter for local development and testing.

## Table of Contents
1. [In-Memory Database for Testing](#1-in-memory-database-for-testing)
2. [Persistent Local Storage](#2-persistent-local-storage)

---

## 1. In-Memory Database for Testing

SQLite is excellent for automated testing because you can use an in-memory database that is completely destroyed when the process exits.

```typescript
import { Backend } from '@quatrain/backend'
import { SqliteAdapter } from '@quatrain/backend-sqlite'

// Use ':memory:' as the filename
const memoryAdapter = new SqliteAdapter({
    config: {
        filename: ':memory:'
    }
})

Backend.addAdapter('default', memoryAdapter, true)

// In your test files:
// await myObject.save() // Saves instantly to RAM
```

## 2. Persistent Local Storage

For CLI tools or local data processing scripts, point the filename to a persistent path.

```typescript
import { Backend } from '@quatrain/backend'
import { SqliteAdapter } from '@quatrain/backend-sqlite'
import path from 'path'

const dbPath = path.join(__dirname, '..', 'app.sqlite')

const localDb = new SqliteAdapter({
    config: {
        filename: dbPath
    }
})

Backend.addAdapter('default', localDb, true)
```
