# How To: Using @quatrain/backend-postgres

This guide explains how to instantiate the PostgreSQL adapter, register it into the global `Backend` registry, and perform operations honoring the **ObjectUri** system.

---

## Table of Contents
1. [Instantiation & Registry Registration](#1-instantiation--registry-registration)
2. [Default Adapter vs Named Adapter with ObjectUri](#2-default-adapter-vs-named-adapter-with-objecturi)
3. [Connection Pooling & SSL Configuration](#3-connection-pooling--ssl-configuration)

---

## 1. Instantiation & Registry Registration

All persistence adapters in Quatrain inherit from `AbstractBackendAdapter` and are registered into the global `Backend` registry.

```typescript
import { Backend } from '@quatrain/backend'
import { PostgresAdapter } from '@quatrain/backend-postgres'

// 1. Instantiate the PostgreSQL adapter
const postgresAdapter = new PostgresAdapter({
  config: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DATABASE || 'quatrain_db',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'secret',
    max: 20 // Connection pool limit
  }
})

// 2. Register into the Backend registry
// Setting setDefault = true makes this adapter the fallback for all models
Backend.addBackend(postgresAdapter, 'postgres', true)
```

---

## 2. Default Adapter vs Named Adapter with ObjectUri

Quatrain uses the **ObjectUri** contract (`[backend:]collection/uid`) to identify records. The association to the correct backend adapter is **automatically deduced from the backend alias in the URI**—there is no need to manually wire adapters or instantiate custom repositories.

### A. Calling the Default Adapter

When you query through the model's dynamic repository without a backend prefix, it automatically routes to the default registered backend:

```typescript
import { Product } from './models/Product'

// Dynamic repository automatically binds to Backend.defaultBackend ('postgres')
const repo = Product.repository()

// Read by UID (implicit ObjectUri: 'products/prod-101')
const product = await repo.read('prod-101')

// The resolved ObjectUri literal includes the backend identifier
console.log(product.uri.literal)    // 'postgres:products/prod-101'
console.log(product.uri.collection) // 'products'
console.log(product.uri.uid)        // 'prod-101'
```

### B. Calling Another Registered Backend Automatically via ObjectUri

When multiple backends are registered (e.g., primary `postgres` and secondary `analytics`), simply pass the qualified `ObjectUri` (or URI string) to `repo.read()`. The framework automatically resolves the target backend from the URI prefix:

```typescript
import { Product } from './models/Product'
import { ObjectUri } from '@quatrain/core'

const repo = Product.repository()

// 1. Pass the URI string with the backend alias prefix:
// Quatrain automatically routes this read to the 'analytics' backend adapter:
const itemA = await repo.read('analytics:products/prod-999')

// 2. Or pass an ObjectUri instance:
const uri = new ObjectUri('analytics:products/prod-999')
const itemB = await repo.read(uri) // Automatically routes to 'analytics'

// 3. Active record mutations preserve the backend association automatically:
itemB.set('inStock', false)
await itemB.save() // Automatically executes update on the 'analytics' backend!
```

---

## 3. Connection Pooling & SSL Configuration

For managed cloud providers (AWS RDS, Neon, Scaleway), configure SSL and timeout options in the `config` block:

```typescript
const cloudPg = new PostgresAdapter({
  config: {
    host: process.env.PG_HOST,
    port: 5432,
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
  }
})

Backend.addBackend(cloudPg, 'cloud-pg', false)
```
