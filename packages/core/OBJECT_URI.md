# ObjectUri in Quatrain Core

## Philosophy

The `ObjectUri` class is the central routing and identification mechanism in Quatrain Core. It acts as the "agnostic glue" between `DataObject` instances and backends. 
Instead of relying on simple strings or raw UUIDs, Quatrain uses `ObjectUri` to encapsulate all the necessary routing information required to locate, load, or persist an object anywhere in the system.

This abstraction allows objects to seamlessly switch backends, exist in nested hierarchies (sub-collections), and be universally referencable.

## Anatomy of an ObjectUri

An `ObjectUri` can represent paths with varying levels of specificity. The parsing mechanism handles different formats:

1. **Simple ID**: `'12345'`
   - Treated as a `uid` without a collection. 
   - The collection name will be injected later when the URI is bound to a specific class (via `uri.class = Model`).
2. **Standard Path**: `'users/12345'`
   - Resolves the collection (`users`) and the unique identifier (`12345`).
3. **Backend-Specific Path**: `'@postgres:users/12345'`
   - Includes a routing instruction for the backend dispatcher. `backend` = `'@postgres'`, `path` = `'users/12345'`.
4. **Nested Path (Sub-collections)**: `'workspaces/999/users/12345'`
   - Supports hierarchies. The parser divides this into a `parent` ObjectUri (`workspaces/999`) and an `ownPath` (`users/12345`).

## Core Principles

### 1. Late Collection Binding
When using `.factory('12345')` on a model, the initial string only provides the `uid`. The `ObjectUri` temporarily sets the collection to `_?_` (Missing Collection). Once the DataObject factory binds the model's class to the URI (`dao.uri.class = child`), the `ObjectUri` automatically derives the correct collection name from the class's `COLLECTION` static property (or its lowercase class name).

### 2. Separation of Path and Literal
- **`path`**: The full logical path, e.g., `users/12345`. If the object has a parent, the parent's path is prepended automatically (`parent.path + '/' + ownPath`).
- **`ownPath`**: Just the object's specific segment, e.g., `users/12345` (ignoring parents).
- **`literal`**: The absolute string representation including the backend alias, e.g., `@sqlite:users/12345`.

### 3. File Paths Handling
`ObjectUri` has specific logic to handle file paths. If the final segment of the path contains an extension (e.g., `.` like `documents/file.pdf`), the parser considers the whole last segment as the `uid`.

### 4. Reference Portability
`ObjectUri` can convert itself into a lightweight reference using `.toReference()`. This is particularly useful when nesting object references inside properties without deeply serializing the whole object.

## Examples of Usage

```typescript
import { ObjectUri } from '@quatrain/core'

// 1. Creating a fully qualified URI
const uri1 = new ObjectUri('@firestore:projects/abc-123')
console.log(uri1.backend)    // '@firestore'
console.log(uri1.collection) // 'projects'
console.log(uri1.uid)        // 'abc-123'

// 2. Creating a URI from just an ID (needs class binding later)
const uri2 = new ObjectUri('abc-123')
uri2.class = Project // Automatically sets collection to 'projects'
console.log(uri2.path)       // 'projects/abc-123'

// 3. Changing paths dynamically
const uri3 = new ObjectUri()
uri3.path = 'users/xyz'
console.log(uri3.uid)        // 'xyz'
```

## 5. Distributed Architectures and Legacy Systems

A core motivation behind the `ObjectUri` design is the ability to easily "embed" references to records originating from entirely different backends. Because an `ObjectUri` can explicitly dictate its target backend (e.g., `@oracle:customers/4001` or `@db2:invoices/882`), it allows Quatrain objects to hold relationships to data stored in legacy systems without requiring data migration.

This capability makes the architecture inherently decentralized. A modern application built on a primary database (like Postgres or Firestore) can transparently hold, query, and resolve references to distributed and diverse data sources, seamlessly bridging the gap between legacy databases and modern infrastructure.

## Summary
The `ObjectUri` guarantees that regardless of how a developer requests an object—whether by a raw ID, a relative path, or an absolute backend reference—the Quatrain underlying layers will reliably resolve the `collection`, `parent`, `uid`, and target `backend`.
