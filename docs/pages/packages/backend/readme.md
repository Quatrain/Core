# @quatrain/backend

This package provides the database abstraction layer for Quatrain Core. It adds persistence capabilities to the in-memory objects from `@quatrain/core`.

## Features

- **Abstract Adapter**: `AbstractBackendAdapter` defines a consistent interface for all database adapters.
- **Query Builder**: A powerful query system with support for filtering, sorting, and pagination.
- **Dynamic Relational Collections**: `CollectionProperty` representing one-to-many and many-to-many parent-child associations.
- **Server-Side Aggregations**: Compute `sum`, `average`, `distinct`, `min`, `max`, and `count` aggregates natively in the database without loading entities into memory.
- **Asynchronous Bulk Processing**: Apply batch calculations and async transformations across collection elements using `.apply()`.
- **Repositories**: Implements the repository pattern for a clean data access layer.
- **Middleware Support**: Hooks for data transformation and validation before database operations.

## Installation

```bash
npm install @quatrain/backend
```

## Quick Start

### 1. Database-Level Collection Aggregations

When performing calculations over huge datasets (like thousands of invoice lines), loading everything into application memory is extremely slow. `@quatrain/backend` allows you to execute these calculations natively in the database engine:

```typescript
import { Invoice } from './models/Invoice'
import { CollectionProperty } from '@quatrain/backend'

// Load the invoice parent model
const invoice = await Invoice.fromBackend<Invoice>('invoice-uuid')
const lines = invoice.dataObject.get('lines') as CollectionProperty

// Calculate aggregate metrics directly in the database (Zero hydration overhead!)
const totalHT = await lines.sum('amount')
const averageLinePrice = await lines.average('amount')
const uniqueCategories = await lines.distinct('category')
const lineCount = await lines.count()

console.log(`Total HT: ${totalHT} €, Average: ${averageLinePrice} €, Items: ${lineCount}`)
```

### 2. Asynchronous Bulk Operations with `.apply()`

For complex business domain calculations where you need to run specific object lifecycle hooks, validation constraints, and database save triggers on each collection element, use `.apply(fn)`:

```typescript
// Apply a discount and persist all items using their own domain model logic
const updatedPrices = await lines.apply(async (line) => {
   const newAmount = line.val('amount') * 0.9 // 10% discount
   line.set('amount', newAmount)
   
   // Save individually to trigger encryption/validation middlewares
   await line.save()
   return line.val('amount')
})
```

## Documentation

For extensive production-grade examples, complete model setups, and step-by-step guides for **Invoice/Billing Management (Facturation)** and **Groups/People Management**, check out the:

👉 **[HOWTO.md Guide](HOWTO.md)**

## License

AGPL-3.0-only
