---
type: pattern
title: Unified Object Storage
description: Abstract object storage interface for S3, MinIO, and local filesystems using Storage.addStorage() from @quatrain/storage.
tags:
  - quatrain
  - storage
  - s3
  - minio
  - files
timestamp: 2026-09-17T00:00:00.000Z
category: storage-and-assets
status: active
---

# Unified Object Storage

Quatrain provides a uniform API for file and object storage across cloud environments using `@quatrain/storage`. The application interacts with `Storage.getStorage()`, decoupling business logic from S3 SDKs, local filesystem paths, or MinIO clusters.

---

## 🎯 Architectural Principles

1. **Storage Registry**: Storage backends are registered via `Storage.addStorage(adapter, alias, setDefault)`.
2. **Stream-First Uploads**: Files are uploaded by passing a `FileType` descriptor and a `Readable` stream to `adapter.create(file, stream)`.
3. **Presigned URLs**: Secure, temporary access URLs are generated through `adapter.getUrl(file, expiresIn, 'read')`.

---

## ⚖️ Implementation Patterns

### 1. Registering an S3/MinIO Storage Backend
```typescript
import { Storage } from "@quatrain/storage";
import { S3StorageAdapter } from "@quatrain/storage-s3";

const s3Adapter = new S3StorageAdapter({
  alias: "s3-main",
  config: {
    bucket: process.env.S3_BUCKET || "app-assets",
    region: process.env.S3_REGION || "eu-west-1",
    endpoint: process.env.S3_ENDPOINT, // Optional custom MinIO endpoint
    accesskey: process.env.S3_ACCESS_KEY || "",
    secret: process.env.S3_SECRET_KEY || "",
  },
});

// Register as the default storage backend
Storage.addStorage(s3Adapter, "s3", true);
```

---

### 2. Uploading a File & Generating a Presigned URL
```typescript
import { Storage } from "@quatrain/storage";
import type { FileType } from "@quatrain/storage";
import { Readable } from "node:stream";

export async function uploadUserAsset(
  userId: string,
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const storage = Storage.getStorage(); // Get default storage adapter

  const fileMeta: FileType = {
    bucket: "app-assets",
    ref: `users/${userId}/${fileName}`,
    contentType,
    size: buffer.length,
  };

  const stream = Readable.from(buffer);

  // Upload stream
  await storage.create(fileMeta, stream);

  // Generate a presigned download URL valid for 3600 seconds (1 hour)
  const downloadUrl = await storage.getUrl(fileMeta, 3600, "read");
  return downloadUrl;
}
```
