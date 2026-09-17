---
type: pattern
title: Quatrain Repository Pattern
description: Database access using PersistedBaseObject, Model.repository() dynamic binding, and typed queries with BaseRepository.
tags:
  - quatrain
  - backend
  - repository
  - active-record
  - queries
timestamp: 2026-09-17T00:00:00.000Z
category: persistence-adapters
status: active
---

# Quatrain Repository Pattern

In Quatrain, persistent domain entities inherit from `PersistedBaseObject` (from `@quatrain/backend`). Every persistent class automatically provides a pre-bound, strongly-typed `BaseRepository` via the static `.repository()` method.

---

## 🎯 Architectural Principles

1. **Zero-Boilerplate Default**: Standard CRUD operations do not require declaring custom repository classes; calling `MyModel.repository()` dynamically instantiates and caches a pre-bound `BaseRepository`.
2. **Domain Encapsulation**: Domain-specific query helpers or aggregation routines are encapsulated in custom repository classes extending `BaseRepository<T>`.
3. **Decoupled Backend Engine**: Repositories operate against the registered backend adapter (`PostgresAdapter`, `SQLiteAdapter`, etc.) without raw database coupling.

---

## ⚖️ Implementation Patterns

### ❌ Anti-Pattern: Leaking Raw Database Queries in Controllers
```typescript
// ❌ BAD: Leaking SQL client and raw strings directly in controllers
import { pool } from "../database";

async function findActiveUsers() {
  const result = await pool.query("SELECT * FROM users WHERE is_active = true");
  return (result.rows as any); // ❌ Untyped, unvalidated, database tightly coupled
}
```

### ✅ Standard Pattern: PersistedBaseObject & BaseRepository
```typescript
// ✅ GOOD: Declarative schema, typed properties, zero-boilerplate repository access
import {
  PersistedBaseObject,
  BaseRepository,
  Query,
} from "@quatrain/backend";
import {
  StringProperty,
  BooleanProperty,
  NumberProperty,
  Core,
} from "@quatrain/core";
import type { DataObjectClass } from "@quatrain/core";

export class Article extends PersistedBaseObject {
  static COLLECTION = "articles";

  static PROPS_DEFINITION = [
    {
      name: "title",
      type: StringProperty.TYPE,
      required: true,
    },
    {
      name: "published",
      type: BooleanProperty.TYPE,
      default: false,
    },
    {
      name: "viewCount",
      type: NumberProperty.TYPE,
      default: 0,
    },
  ];

  constructor(dao: DataObjectClass<any>) {
    super(dao);
  }
}

// Register class with Quatrain Core registry
Core.addClass("Article", Article);

// --- Standard CRUD Operations ---
async function manageArticle() {
  const repo = Article.repository();

  // 1. Create
  const article = await Article.factory({
    name: "art_101",
    title: "Understanding OKF v0.1",
    published: true,
    viewCount: 120,
  });
  const saved = await repo.create(article);

  // 2. Read by UID
  const loaded = await repo.read("art_101");

  // 3. Update
  if (loaded) {
    loaded.set("viewCount", 125);
    await repo.update(loaded);
  }

  // 4. Delete
  await repo.delete("art_101");
}
```

---

## 💡 Advanced Querying with Query Builder

For filtered searches and pagination, use `Query` executed via `repo.query()`:

```typescript
import { Article } from "./Article";
import { Query } from "@quatrain/backend";

export async function searchPublishedArticles(): Promise<Article[]> {
  const repo = Article.repository();

  const query = new Query(Article);
  query
    .where("published", true)
    .sortBy("viewCount", "desc")
    .batch(20);

  // Executes query against current backend adapter
  const result = await repo.query(query);

  console.log(`Found ${result.meta.count} articles`);
  return result.items;
}
```

---

## 💡 Custom Repository Extension

If a model requires custom domain queries, extend `BaseRepository` and attach it to the model via `REPOSITORY_CLASS`:

```typescript
import { BaseRepository, Query } from "@quatrain/backend";
import { Article } from "./Article";

export class ArticleRepository extends BaseRepository<Article> {
  async findTrendingArticles(minViews: number): Promise<Article[]> {
    const query = new Query(Article);
    query
      .where("published", true)
      .where("viewCount", minViews, ">=")
      .sortBy("viewCount", "desc");

    const result = await this.query(query);
    return result.items;
  }
}

// Bind custom repository class to the model
Article.REPOSITORY_CLASS = ArticleRepository;
```
