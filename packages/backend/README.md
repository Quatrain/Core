# @quatrain/backend

This package provides the database abstraction layer for Quatrain Core. It adds persistence capabilities to the in-memory objects from `@quatrain/core`.

## Features

-  **Abstract Adapter**: `AbstractBackendAdapter` defines a consistent interface for all database adapters.
-  **Query Builder**: A powerful query system with support for filtering, sorting, and pagination.
-  **Repositories**: Implements the repository pattern for a clean data access layer.
-  **Middleware Support**: Hooks for data transformation and validation before database operations.

## Installation

```bash
npm install @quatrain/backend
```

## Usage

This package is meant to be used with a concrete database adapter, such as `@quatrain/backend-postgres` or `@quatrain/backend-firestore`.

```typescript
import { Backend, Filter, OperatorKeys } from '@quatrain/backend'
import { User } from '@quatrain/core'

// Assuming an adapter has been added
const users = await Backend.find(User.factory(), [
   new Filter('status', 'active', OperatorKeys.equals),
])
```

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).
