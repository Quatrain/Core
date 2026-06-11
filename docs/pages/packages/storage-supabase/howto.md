# How To: Using @quatrain/storage-supabase

This guide covers Supabase-specific storage operations.

## Table of Contents
1. [Public URLs vs Signed URLs](#1-public-urls-vs-signed-urls)
2. [Uploading assets](#2-uploading-assets)

---

## 1. Public URLs vs Signed URLs

Supabase buckets can be public or private. By default, `getUrl()` fetches the public URL if the bucket is configured as public in Supabase.

```typescript
import { Storage } from '@quatrain/storage'

async function getImageUrl(imagePath: string) {
    const storage = Storage.getAdapter('supabase')
    
    // Will return https://xxx.supabase.co/storage/v1/object/public/images/...
    const publicUrl = await storage.getUrl('images', imagePath)
    
    return publicUrl
}
```

## 2. Uploading assets

Uploading an asset to Supabase storage behaves exactly like other adapters.

```typescript
import { Storage } from '@quatrain/storage'

async function saveDocument(buffer: Buffer) {
    const storage = Storage.getAdapter()
    
    await storage.put('secure-documents', 'user-1/contract.pdf', buffer, {
        contentType: 'application/pdf'
    })
}
```
