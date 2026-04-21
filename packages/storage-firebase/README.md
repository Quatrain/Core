# @quatrain/storage-firebase

The Firebase Storage adapter for `@quatrain/storage`. 

## Introduction

This adapter enables you to securely upload, download, and manage files in Google Cloud Storage buckets linked to your Firebase project, using the standard Quatrain API.

## Installation

```bash
npm install @quatrain/storage-firebase firebase-admin
# or
yarn add @quatrain/storage-firebase firebase-admin
```

## Configuration

Register the adapter by providing your Firebase service account credentials.

```typescript
import { Storage } from '@quatrain/storage'
import { FirebaseStorageAdapter } from '@quatrain/storage-firebase'

const firebaseAdapter = new FirebaseStorageAdapter({
    config: {
        projectId: 'your-project-id',
        clientEmail: 'firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
    }
})

Storage.addAdapter('firebase', firebaseAdapter, true)
```

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
