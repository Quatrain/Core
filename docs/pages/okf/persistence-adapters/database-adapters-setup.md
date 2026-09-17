---
type: pattern
title: Database Adapters Setup
description: Setting up and configuring persistence adapters for PostgreSQL and SQLite using Backend.addBackend() in Quatrain Core.
tags:
  - quatrain
  - backend
  - database
  - postgres
  - sqlite
timestamp: 2026-09-17T00:00:00.000Z
category: persistence-adapters
status: active
---

# Database Adapters Setup

Quatrain uses an adapter-driven persistence architecture managed by `Backend.addBackend()`. Domain models and repositories interact with abstract interfaces, allowing identical application code to run against PostgreSQL, SQLite, or in-memory stores.

---

## 🎯 Architectural Principles

1. **Global Adapter Registration**: Backend adapters are registered during application bootstrap via `Backend.addBackend(adapter, alias, setDefault)`.
2. **Configuration Validation**: Always validate connection parameters (host, port, credentials) prior to starting servers.
3. **Multi-Backend Support**: Multiple backends can coexist under distinct aliases, enabling different models to target different databases.

---

## ⚖️ Implementation Patterns

### 1. PostgreSQL Adapter (`@quatrain/backend-postgres`)

Standard relational adapter with connection pooling via `pg`:

```typescript
import { Backend } from "@quatrain/backend";
import { PostgresAdapter } from "@quatrain/backend-postgres";

const host = process.env.PG_HOST || "localhost";
const port = parseInt(process.env.PG_PORT || "5432", 10);
const database = process.env.PG_DATABASE || "quatrain_db";
const user = process.env.PG_USER || "postgres";
const password = process.env.PG_PASSWORD;

if (!password) {
  throw new Error("Missing PG_PASSWORD environment variable.");
}

const pgAdapter = new PostgresAdapter({
  config: {
    host,
    port,
    database,
    user,
    password,
    max: 20, // Pool client limit
  },
});

// Register as the default backend
Backend.addBackend(pgAdapter, "postgres", true);
```

---

### 2. SQLite Adapter (`@quatrain/backend-sqlite`)

Lightweight SQL adapter ideal for local development, edge computing, and unit tests:

```typescript
import { Backend } from "@quatrain/backend";
import { SQLiteAdapter } from "@quatrain/backend-sqlite";

const sqlitePath = process.env.SQLITE_DATABASE || "./data/app.sqlite";

const sqliteAdapter = new SQLiteAdapter({
  config: {
    database: sqlitePath, // Or ':memory:' for transient test suites
  },
});

// Register as the default backend
Backend.addBackend(sqliteAdapter, "sqlite", true);
```
