# @quatrain/backend-firestore

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
