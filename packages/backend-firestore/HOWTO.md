# How To: Using @quatrain/backend-firestore

This guide explains how to instantiate the Google Cloud Firestore adapter, register it into the global `Backend` registry, and perform operations honoring the **ObjectUri** system.

---

## Table of Contents
1. [Instantiation & Registry Registration](#1-instantiation--registry-registration)
2. [Default Adapter vs Named Adapter with ObjectUri](#2-default-adapter-vs-named-adapter-with-objecturi)
3. [Hierarchical Collections & Subcollections](#3-hierarchical-collections--subcollections)

---

## 1. Instantiation & Registry Registration

All persistence adapters in Quatrain inherit from `AbstractBackendAdapter` and are registered into the global `Backend` registry.

```typescript
import { Backend } from '@quatrain/backend'
import { FirestoreAdapter } from '@quatrain/backend-firestore'

// 1. Instantiate the Firestore adapter with Firebase credentials
const firestoreAdapter = new FirestoreAdapter({
  config: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'my-firebase-app'
  }
})

// 2. Register into the Backend registry
// Setting setDefault = true makes this adapter the fallback for all models
Backend.addBackend(firestoreAdapter, 'firestore', true)
```

---

## 2. Default Adapter vs Named Adapter with ObjectUri

Quatrain uses the **ObjectUri** contract (`[backend:]collection/uid`) to identify records. The association to the correct backend adapter is **automatically deduced from the backend alias in the URI**—there is no need to manually wire adapters or instantiate custom repositories.

### A. Calling the Default Adapter

When you query through the model's dynamic repository without specifying a backend prefix, it automatically routes to the default registered backend:

```typescript
import { Product } from './models/Product'

// Dynamic repository automatically binds to Backend.defaultBackend ('firestore')
const repo = Product.repository()

// Read by UID (implicit ObjectUri: 'products/prod-101')
const product = await repo.read('prod-101')

// The resolved ObjectUri literal includes the backend identifier
console.log(product.uri.literal)    // 'firestore:products/prod-101'
console.log(product.uri.collection) // 'products'
console.log(product.uri.uid)        // 'prod-101'
```

### B. Calling Another Registered Backend Automatically via ObjectUri

When multiple backends are registered (e.g., primary relational `postgres` and cloud document `firestore`), simply pass the qualified `ObjectUri` (or URI string) to `repo.read()`. The framework automatically resolves the target backend from the URI prefix:

```typescript
import { Product } from './models/Product'
import { ObjectUri } from '@quatrain/core'

const repo = Product.repository()

// 1. Pass the URI string with the backend alias prefix:
// Quatrain automatically routes this read to the 'firestore' backend adapter:
const itemA = await repo.read('firestore:products/prod-999')

// 2. Or pass an ObjectUri instance:
const uri = new ObjectUri('firestore:products/prod-999')
const itemB = await repo.read(uri) // Automatically routes to 'firestore'

// 3. Active record mutations preserve the backend association automatically:
itemB.set('inStock', false)
await itemB.save() // Automatically executes update on the 'firestore' backend!
```

---

## 3. Hierarchical Collections & Subcollections

Firestore natively supports subcollections. In Quatrain, subcollection paths are modeled as multi-segment ObjectUris:

```typescript
// Nested document: organization/org-1/products/prod-42
const nestedUri = new ObjectUri('firestore:organizations/org-1/products/prod-42')

const item = await Product.repository().read(nestedUri)
console.log(item.uri.parent?.path) // 'organizations/org-1'
```
