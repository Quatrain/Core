# @quatrain/backend-firestore

> 📦 **API Reference**: Detailed TypeScript documentation, classes, interfaces, and methods are available in the [TypeDoc API Reference for @quatrain/backend-firestore ↗](/api-reference/modules/_quatrain_backend-firestore.html).

A backend adapter for Google Cloud Firestore. This package allows Quatrain to use Firestore as its primary NoSQL database.

## Features

-  Implements the `@quatrain/backend` abstract adapter.
-  Leverages the `@google-cloud/firestore` SDK.
-  Optimized for Firestore's data model, including subcollection handling.
-  Supports real-time listeners for live data synchronization.

## Installation

```bash
npm install @quatrain/backend-firestore @google-cloud/firestore
```

## Usage

```typescript
import { Backend } from '@quatrain/backend'
import { FirestoreAdapter } from '@quatrain/backend-firestore'

const adapter = new FirestoreAdapter({ config: { projectId: 'my-project' } })
Backend.addAdapter(adapter, 'default', true)
```

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).
