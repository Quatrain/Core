# How To: Using @quatrain/storage-s3

This guide explains how to instantiate the AWS S3 storage adapter, register it into the global `Storage` registry, and perform asset operations honoring the **ObjectUri** system.

---

## Table of Contents
1. [Instantiation & Registry Registration](#1-instantiation--registry-registration)
2. [Default Storage vs Named Storage with ObjectUri](#2-default-storage-vs-named-storage-with-objecturi)
3. [Fetching, Deleting & Querying Stats](#3-fetching-deleting--querying-stats)

---

## 1. Instantiation & Registry Registration

All object storage adapters in Quatrain inherit from `AbstractStorageAdapter` and are registered into the global `Storage` registry.

```typescript
import { Storage } from '@quatrain/storage'
import { S3StorageAdapter } from '@quatrain/storage-s3'

// 1. Instantiate the S3 adapter (compatible with AWS S3, MinIO, Scaleway, Ceph)
const s3Adapter = new S3StorageAdapter({
  config: {
    endpoint: process.env.S3_ENDPOINT || 'https://s3.fr-par.scw.cloud',
    region: process.env.S3_REGION || 'fr-par',
    accesskey: process.env.S3_ACCESS_KEY || 'your-access-key',
    secret: process.env.S3_SECRET_KEY || 'your-secret-key'
  }
})

// 2. Register into the Storage registry
// Setting setDefault = true makes this adapter the fallback for all file operations
Storage.addStorage(s3Adapter, 's3', true)
```

---

## 2. Default Storage vs Named Storage with ObjectUri

Quatrain represents persistent binary assets using the **ObjectUri** contract (`[storage:]bucket/path/to/file.ext`).

### A. Calling the Default Storage

Calling `Storage.getStorage()` without arguments returns the adapter registered as default:

```typescript
// Resolves the default storage adapter ('s3')
const defaultStorage = Storage.getStorage()

// Upload a document
await defaultStorage.create('documents/report-2026.pdf', fileBuffer)
```

### B. Calling a Specific Storage Respecting ObjectUri

When multiple storage adapters are registered (e.g. primary `s3` and local fallback `local`), you can inspect the asset's `ObjectUri` to route dynamically:

```typescript
import { Storage } from '@quatrain/storage'
import { ObjectUri } from '@quatrain/core'

// Asset URI specifying the S3 storage backend
const assetUri = new ObjectUri('s3:invoices/2026/inv-001.pdf')

// 1. Extract the target storage backend from the ObjectUri
const targetStorageAlias = assetUri.backend || Storage.defaultStorage // 's3'

// 2. Retrieve the adapter from the registry
const storage = Storage.getStorage(targetStorageAlias)

// 3. Read or stream the asset using the resolved path
const fileBuffer = await storage.get('invoices', '2026/inv-001.pdf')
console.log(`Loaded ${fileBuffer.length} bytes from ${assetUri.literal}`)
```

---

## 3. Fetching, Deleting & Querying Stats

```typescript
import { Storage } from '@quatrain/storage'

async function manageFiles() {
  const storage = Storage.getStorage('s3')

  // Download file buffer
  const data = await storage.get('assets', 'logo.png')

  // Query stats for a folder prefix
  const stats = await storage.getBucketStats('assets', 'logos/')
  console.log(`Total files: ${stats.count}, size: ${stats.size} bytes`)

  // Delete an object
  await storage.delete('assets', 'old-logo.png')
}
```
