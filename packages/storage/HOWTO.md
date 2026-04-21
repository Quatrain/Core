# How To: Using @quatrain/storage

This guide covers the basic operations for managing files via the Quatrain storage abstraction.

## Table of Contents
1. [Registering a Storage Adapter](#1-registering-a-storage-adapter)
2. [Uploading Files](#2-uploading-files)
3. [Retrieving Files and URLs](#3-retrieving-files-and-urls)

---

## 1. Registering a Storage Adapter

Before interacting with files, configure the `Storage` registry with your chosen adapter.

```typescript
import { Storage } from '@quatrain/storage'
import { S3Adapter } from '@quatrain/storage-s3'

const adapter = new S3Adapter({
    config: {
        accesskey: process.env.S3_KEY,
        secret: process.env.S3_SECRET,
        region: 'eu-central-1',
        endpoint: 'https://s3.eu-central-1.amazonaws.com'
    }
})

Storage.addAdapter('default', adapter, true)
```

## 2. Uploading Files

You can upload files using raw buffers or file paths, depending on the adapter's capabilities.

```typescript
import { Storage } from '@quatrain/storage'

async function uploadAvatar(userId: string, imageBuffer: Buffer) {
    const storage = Storage.getAdapter() // Gets the default adapter
    
    // put(bucket, path, data, options)
    await storage.put('user-avatars', `${userId}/avatar.png`, imageBuffer, {
        contentType: 'image/png'
    })
    
    console.log('Upload complete!')
}
```

## 3. Retrieving Files and URLs

Often, you just need a public URL to serve the file to a frontend client.

```typescript
import { Storage } from '@quatrain/storage'

async function getAvatarUrl(userId: string) {
    const storage = Storage.getAdapter()
    
    try {
        // getUrl returns a fully qualified public URL
        const url = await storage.getUrl('user-avatars', `${userId}/avatar.png`)
        return url
    } catch (err) {
        console.error('File not found')
        return null
    }
}
```
