<div align="center">
  <img src="./assets/logo.png" alt="Quatrain Logo" width="300" />
</div>

# Quatrain Core - A Modular BaaS Framework

Quatrain Core is a modular TypeScript framework designed to accelerate business application development with **Backend as a Service (BaaS)** solutions like Firebase and Supabase. It provides a clean separation of concerns between logic, data, and storage, using an adapter pattern to provide consistent interfaces across different BaaS providers.

## 🎯 Core Principles

-  **BaaS-First Architecture**: Built to leverage modern BaaS platforms like Firebase and Supabase for managed databases, authentication, storage, and serverless functions.
-  **Clean Abstraction**: Write your business logic once. The adapter pattern allows you to switch between different backend services (e.g., Firestore, PostgreSQL, Firebase Auth, Supabase Auth) with minimal code changes.
-  **Deployment Flexibility**: While optimized for SaaS, Quatrain fully supports self-hosted solutions. For example, a Supabase-powered application can be deployed via Docker, Kubernetes, or on-premise for data sovereignty, using the exact same codebase.
-  **Modular by Design**: The framework is split into scoped packages. Use only what you need, from core object modeling to authentication, storage, and message queues.
-  **Standalone Core**: The `@quatrain/core` package works entirely in-memory for defining models, validation, and business logic, without requiring any database connection.

## 🏗️ Architecture & Packages

The framework is organized as a monorepo with a foundation package and a suite of adapters for popular services. For a detailed explanation of the architecture and each package, please see [**PACKAGES_OVERVIEW.md**](./PACKAGES_OVERVIEW.md).

```bash
@quatrain/core (Foundation - works standalone)
├── 🔥 Firebase Ecosystem
│   ├── @quatrain/backend-firestore (Firestore NoSQL)
│   ├── @quatrain/auth-firebase (Firebase Auth)
│   ├── @quatrain/storage-firebase (Firebase Storage)
│   ├── @quatrain/cloudwrapper-firebase (Firebase Functions)
│   └── @quatrain/messaging-firebase (FCM)
├── 🟢 Supabase Ecosystem
│   ├── @quatrain/backend-postgres (PostgreSQL - works with Supabase)
│   ├── @quatrain/auth-supabase (Supabase Auth)
│   ├── @quatrain/storage-supabase (Supabase Storage)
│   └── @quatrain/cloudwrapper-supabase (Supabase Edge Functions)
```

## How to use

### 1. In-memory models

The `@quatrain/core` package provides `BaseObject`, which is ideal for in-memory data modeling, validation, and serialization. It does not contain any database-related methods.

```ts
import { BaseObject, Property } from '@quatrain/core'

export type CatData = {
   name: string
   color: `#${string}`
}

export class Cat extends BaseObject {
   static COLLECTION = 'cats'

   static PROPERTIES = [
      {
         name: 'name',
         type: Property.STRING,
         minLength: 1,
         maxLength: 32,
      },
      {
         name: 'color',
         type: Property.STRING,
         minLength: 4,
         maxLength: 7,
      },
   ]
}

const catData: CatData = {
   name: 'Garfield',
   color: '#ffa502',
}

// Instantiate an in-memory object
const garfield = Cat.fromObject(catData)

console.log(garfield._.name)
// > "Garfield"
```

### 2. Persistent models

To interact with a database, your models must inherit from `PersistedBaseObject` provided by the `@quatrain/backend` package. This adds methods like `.save()`, `.delete()`, and `.fromBackend()`.

```ts
import { Property } from '@quatrain/core'
import { PersistedBaseObject } from '@quatrain/backend'

// Notice we now extend PersistedBaseObject
export class PersistedCat extends PersistedBaseObject {
   static COLLECTION = 'cats'

   static PROPERTIES = [
      {
         name: 'name',
         type: Property.STRING,
         minLength: 1,
         maxLength: 32,
      },
      {
         name: 'color',
         type: Property.STRING,
         minLength: 4,
         maxLength: 7,
      },
   ]
}
```

#### Interact with backend

```ts
import { Backend } from '@quatrain/backend'
import { SqliteAdapter } from '@quatrain/backend-sqlite'

// Set up a default backend
Backend.addBackend(new SqliteAdapter(), 'sqlite', true)

const catData = { name: 'Garfield', color: '#ffa502' }

// Instantiate a persistent object
const garfield = PersistedCat.fromObject(catData)

// Let's save Garfield in our database
await garfield.save()

// Now, let's retrieve Garfield from the database using its path
const retrievedGarfield = await PersistedCat.fromBackend(garfield.asReference().path)

console.log(retrievedGarfield._.name)
// > "Garfield"
```

### 3. Using repositories

You can use repositories to encapsulate your business logic and backend operations.

```ts
import { BackendInterface, BaseRepository } from '@quatrain/backend'

export default class CatRepository extends BaseRepository<PersistedCat> {
   constructor(backendAdapter: BackendInterface = Backend.getBackend()) {
      super(PersistedCat, backendAdapter)
   }

   async delete(uid: string) {
      throw Error("Don't delete the cats!")
   }
}
```

Now, let's use our new `CatRepository`.

```ts
const repository = new CatRepository()

// Create a new cat in the database
const createdCat = await repository.create(garfield)

// Read from database using its UID
const persistedGarfield = await repository.read(createdCat.uid)

// Update
persistedGarfield._.color = '#ff0000'
await repository.update(persistedGarfield)

// Delete
await repository.delete(persistedGarfield.uid) // Will throw "Don't delete the cats!"
```

## ⚖️ License & Professional Services

Quatrain Core is released under the **AGPL-3.0** (Affero General Public License). This ensures that any enhancements to the open-source core remain free and accessible to the community. If you build a SaaS or application using this framework, you must comply with the AGPL-3.0 terms.

**Professional Services & Commercial Licensing**  
If your organization requires a commercial license (to integrate Quatrain Core without the AGPL-3.0 restrictions), or if you need expert assistance, the **Quatrain** team offers:
- **Commercial Licensing**: Tailored licenses for proprietary software and enterprise deployments.
- **Custom Development**: Expert engineers to help you build or migrate your backend architecture.
- **Premium Support**: Priority SLA, architectural consulting, and code reviews.

Contact us at **developers@quatrain.com** to discuss your project needs.
