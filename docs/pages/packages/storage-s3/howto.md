# How To: Using @quatrain/storage-s3

This guide provides practical examples for interacting with S3 buckets.

## Table of Contents
1. [Fetching Files](#1-fetching-files)
2. [Deleting Files](#2-deleting-files)
3. [Querying Storage Stats with S3 Prefixes](#3-querying-storage-stats-with-s3-prefixes)

---

## 1. Fetching Files

You can download a file directly to your Node environment using the `get` method.

```typescript
import { Storage } from '@quatrain/storage'

async function downloadConfig() {
    const storage = Storage.getAdapter('s3')
    
    // Returns the file data as a Buffer
    const fileBuffer = await storage.get('config-bucket', 'settings.json')
    
    const settings = JSON.parse(fileBuffer.toString('utf-8'))
    console.log(settings)
}
```

## 2. Deleting Files

Cleaning up storage is simple and abstracted.

```typescript
import { Storage } from '@quatrain/storage'

async function removeOldAvatar(userId: string) {
    const storage = Storage.getAdapter('s3')
    
    try {
        await storage.delete('user-avatars', `${userId}/avatar-old.png`)
        console.log('File deleted')
    } catch (err) {
        console.error('Failed to delete file', err)
    }
}
```

## 3. Querying Storage Stats with S3 Prefixes

You can query metadata, total file counts, aggregate sizes, and last modified timestamps of objects matching a prefix directly from the AWS S3 adapter.

```typescript
import { Storage } from '@quatrain/storage'

async function logBucketStats(companyId: string) {
    const storage = Storage.getAdapter('s3')
    
    // getBucketStats(bucket, prefix)
    const stats = await storage.getBucketStats('my-documents-bucket', `companies/${companyId}`)
    
    console.log(`Matching objects count: ${stats.totalObjects}`)
    console.log(`Aggregate size in bytes: ${stats.totalSize}`)
    console.log(`Raw objects:`, stats.objects)
}
```
