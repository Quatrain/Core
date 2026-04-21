# How To: Using @quatrain/storage-firebase

This guide demonstrates how to use the Firebase Storage adapter.

## Table of Contents
1. [Signed URLs](#1-signed-urls)
2. [Uploading Large Files](#2-uploading-large-files)

---

## 1. Signed URLs

Firebase Storage allows generating temporary, signed URLs for private files. Using `getUrl()` on this adapter can return a signed URL if specified.

```typescript
import { Storage } from '@quatrain/storage'

async function getPrivateDownloadUrl(filePath: string) {
    const storage = Storage.getAdapter('firebase')
    
    // Some adapters can accept an options object to dictate signed URL expiration
    const url = await storage.getUrl('my-private-bucket', filePath, {
        action: 'read',
        expires: '03-09-2491'
    })
    
    return url
}
```

## 2. Uploading Large Files

You can use the adapter's `put` method to stream buffers directly to the Firebase bucket.

```typescript
import fs from 'fs'
import { Storage } from '@quatrain/storage'

async function uploadReport() {
    const storage = Storage.getAdapter()
    const fileBuffer = fs.readFileSync('/tmp/report.pdf')
    
    await storage.put('reports', '2026/april/report.pdf', fileBuffer, {
        contentType: 'application/pdf'
    })
}
```
