# Quatrain Core - Application Development Guidelines (AI & Developer Guide)

This document outlines the core guidelines, architectural patterns, and structural rules for AI agents and developers building applications **using** the Quatrain Core framework.

**When writing application code, models, and business logic on top of Quatrain, you MUST adhere to the following rules.**

---

## 1. Architectural Guidelines & Model Design

These rules govern how you declare, load, and manage database-persisted entities within your application.

### A. Model Property Definitions (`PROPS_DEFINITION`)

When defining model property schemas, you MUST use the framework's static `.TYPE` properties. Never use raw string literals for property types, as it bypasses the compiler, leading to runtime failures.

- ❌ **DO NOT use string literals for property types:**
  ```typescript
  export const MyModelDef = [
     { name: 'isDefault', type: 'BooleanProperty' } // ❌ Raw string literal
  ]
  ```

- ✅ **DO use the `.TYPE` constant from the imported property class:**
  ```typescript
  import { BooleanProperty } from '@quatrain/core'
  
  export const MyModelDef = [
     { name: 'isDefault', type: BooleanProperty.TYPE } // ✅ Strongly typed
  ]
  ```

### B. Relational Properties Naming Convention

All properties referencing another database model must be named exactly as the **camelCase** version of the target model's class name, without any `"Id"` or `"_id"` suffix.

- ❌ **DO NOT suffix relational properties with "Id" or use generic names:**
  ```typescript
  // ❌ BAD:
  { name: 'userId', type: ObjectProperty.TYPE, instanceOf: 'User' }
  { name: 'model', type: ObjectProperty.TYPE, instanceOf: 'StudioModel' }
  ```

- ✅ **DO name it camelCase matching the class exactly:**
  ```typescript
  // ✅ GOOD:
  { name: 'user', type: ObjectProperty.TYPE, instanceOf: 'User' }
  { name: 'studioModel', type: ObjectProperty.TYPE, instanceOf: 'StudioModel' }
  ```

### C. Circular Object Reference Resolution

Because models often reference each other, you must register every model class inside Quatrain's global registry at the bottom of the file. This allows circular relationships to resolve cleanly at runtime.

- ✅ **Always register class names at the bottom of the model file:**
  ```typescript
  import { Core } from '@quatrain/core'
  
  export class Invoice extends PersistedBaseObject { /* ... */ }
  
  Core.addClass('Invoice', Invoice)
  ```

---

## 2. Instantiating & Loading Models

Always leverage Quatrain's repository facade and hydration methods rather than custom query loops or manual object building.

### A. Instantiating New Objects vs Loading by ID

- **Creating a new instance (empty or with initial data):** Use `factory()`.
- **Loading an existing instance by ID:** Use `fromBackend()` or `.repository().read()`.

```typescript
// ✅ Creating a new draft instance
const newInvoice = await Invoice.factory({ status: 'draft' })

// ✅ Loading an existing record from backend
const existingInvoice = await Invoice.fromBackend<Invoice>('inv-2026-001')
```

### B. Soft Deletes Handling

By default, Quatrain uses a "soft delete" system via the `status` property. Calling `.delete()` sets `status = 'deleted'`.
- **CRITICAL:** When running manual raw queries (e.g. via `apiClient.get()` or custom backend filters), you MUST explicitly filter out deleted items unless database middleware automates it.

```typescript
// Always filter out soft-deleted items explicitly in manual queries
const result = await Backend.execute(Model, 'read', { 
   filters: { 'status:neq': 'deleted' } 
})
```

---

## 3. The Repository Pattern (CRUD & Queries)

Quatrain completely abstracts database interactions to eliminate the need for boilerplate repository classes.

### Option A: Zero-Boilerplate Repository Access (Recommended)

Every model class automatically provides a pre-bound, cached `BaseRepository` instance out-of-the-box via the static `.repository()` method.

```typescript
// Get the pre-bound repository
const productRepo = Product.repository()

// Perform CRUD operations instantly!
const savedProduct = await productRepo.create(draftProduct)
const product = await productRepo.read(savedProduct.dataObject.uid)
```

### Option B: Custom Repository Overrides

If a model requires custom domain queries (e.g. `findActiveUsers()`), inherit from `BaseRepository` and configure `REPOSITORY_CLASS` on the model:

```typescript
import { BaseRepository, Query } from '@quatrain/backend'

// 1. Declare the custom repository
export class UserRepository extends BaseRepository<User> {
   async findActiveUsers() {
      const query = new Query(User).filter('isActive', 'eq', true)
      return await this.query(query)
   }
}

// 2. Bind it to the Model
export class User extends PersistedBaseObject {
   static COLLECTION = 'users'
   static REPOSITORY_CLASS = UserRepository
}

// 3. User.repository() now automatically returns UserRepository!
const activeUsers = await User.repository().findActiveUsers()
```

### Option C: Central Registry Dynamic Lookup

To retrieve repositories in decoupled service modules or dynamic lookup scripts, use `Repository.for`:

```typescript
import { Repository } from '@quatrain/backend'

// Registers or resolves the bound repository instance dynamically
const repo = Repository.for(Invoice)
```

---

## 4. Coding Practices & Encapsulation

- **Type Annotations:** Never declare un-initialized variables without an explicit type (prevents compilation leaking).
  - ❌ **BAD:** `let match;`
  - ✅ **GOOD:** `let match: string | null = null;`
- **Class Properties:** Prefer `protected` over `private` to allow clean class inheritance and extensions.
- **API Updates:** Always prefer `PATCH` over `PUT` for updates to optimize data payloads, since Quatrain tracks modified properties natively via a `hasChanged` flag.
- **Clean Imports (Post-Refactoring):** Always verify and ensure that all imports are still useful and consumed after any refactoring. Proactively remove any unused imports to maintain clean compile hygiene and avoid namespace pollution.
