# @quatrain/backend-sqlite

The SQLite adapter for `@quatrain/backend`. This package allows Quatrain business objects to be persisted locally in a lightweight, file-based SQL database.

## Introduction

SQLite is perfect for local development, testing, CLI tools, or mobile/desktop applications built with Node.js/Electron. This adapter translates Quatrain models into local SQLite tables and queries.

## Installation

```bash
npm install @quatrain/backend-sqlite sqlite3
# or
yarn add @quatrain/backend-sqlite sqlite3
```

## Configuration

Register the adapter with the path to your `.sqlite` file. If the file does not exist, it will be created automatically.

```typescript
import { Backend } from '@quatrain/backend'
import { SqliteAdapter } from '@quatrain/backend-sqlite'

const sqliteAdapter = new SqliteAdapter({
    config: {
        filename: './data/database.sqlite'
    }
})

Backend.addAdapter('sqlite', sqliteAdapter, true)
```

## License

AGPL-3.0-only
