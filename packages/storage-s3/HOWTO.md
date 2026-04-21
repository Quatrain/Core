# How To: Using @quatrain/storage-s3

This guide provides practical examples for interacting with S3 buckets.

## Table of Contents
1. [Fetching Files](#1-fetching-files)
2. [Deleting Files](#2-deleting-files)

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
