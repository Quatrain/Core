# How To: Using @quatrain/backend-sqlite

This guide explains how to instantiate the SQLite adapter, register it into the global `Backend` registry, and perform operations honoring the **ObjectUri** system.

---

## Table of Contents
1. [Instantiation & Registry Registration](#1-instantiation--registry-registration)
2. [Default Adapter vs Named Adapter with ObjectUri](#2-default-adapter-vs-named-adapter-with-objecturi)
3. [In-Memory Database for Testing](#3-in-memory-database-for-testing)

---

## 1. Instantiation & Registry Registration

All persistence adapters in Quatrain inherit from `AbstractBackendAdapter` and are registered into the global `Backend` registry.

```typescript
import { Backend } from '@quatrain/backend'
import { SQLiteAdapter } from '@quatrain/backend-sqlite'

// 1. Instantiate the SQLite adapter pointing to a local file
const sqliteAdapter = new SQLiteAdapter({
  config: {
    database: process.env.SQLITE_PATH || './data/app.sqlite'
  }
})

// 2. Register into the Backend registry
// Setting setDefault = true makes this adapter the fallback for all models
Backend.addBackend(sqliteAdapter, 'sqlite', true)
```

---

## 2. Default Adapter vs Named Adapter with ObjectUri

Quatrain uses the **ObjectUri** contract (`[backend:]collection/uid`) to identify records. The association to the correct backend adapter is **automatically deduced from the backend alias in the URI**—there is no need to manually wire adapters or instantiate custom repositories.

### A. Calling the Default Adapter

When querying through the model's dynamic repository without a backend prefix, it automatically routes to the default registered backend:

```typescript
import { Product } from './models/Product'

// Dynamic repository automatically binds to Backend.defaultBackend ('sqlite')
const repo = Product.repository()

// Read by UID (implicit ObjectUri: 'products/prod-101')
const product = await repo.read('prod-101')

// The resolved ObjectUri literal includes the backend identifier
console.log(product.uri.literal)    // 'sqlite:products/prod-101'
console.log(product.uri.collection) // 'products'
console.log(product.uri.uid)        // 'prod-101'
```

### B. Calling Another Registered Backend Automatically via ObjectUri

When multiple backends are registered (e.g., primary `postgres` and local cache `sqlite`), pass the qualified `ObjectUri` (or URI string) to `repo.read()`. The framework automatically resolves the target backend from the URI prefix:

```typescript
import { Product } from './models/Product'
import { ObjectUri } from '@quatrain/core'

const repo = Product.repository()

// 1. Pass the URI string with the backend alias prefix:
// Quatrain automatically routes this read to the 'sqlite' backend adapter:
const itemA = await repo.read('sqlite:products/prod-101')

// 2. Or pass an ObjectUri instance:
const uri = new ObjectUri('sqlite:products/prod-101')
const itemB = await repo.read(uri) // Automatically routes to 'sqlite'

// 3. Active record mutations preserve the backend association automatically:
itemB.set('inStock', false)
await itemB.save() // Automatically executes update on the 'sqlite' backend!
```

---

## 3. In-Memory Database for Testing

SQLite is ideal for test suites because you can run fully in RAM without filesystem leftovers:

```typescript
const memoryAdapter = new SQLiteAdapter({
  config: {
    database: ':memory:'
  }
})

Backend.addBackend(memoryAdapter, 'test-db', true)
```
