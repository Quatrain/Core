# @quatrain/cloudwrapper-firebase

> 📦 **API Reference**: Detailed TypeScript documentation, classes, interfaces, and methods are available in the [TypeDoc API Reference for @quatrain/cloudwrapper-firebase ↗](/api-reference/modules/_quatrain_cloudwrapper-firebase.html).

The Firebase ecosystem wrapper for `@quatrain/cloudwrapper`.

## Introduction

This package aggregates the initialization of:
- `@quatrain/backend-firestore`
- `@quatrain/storage-firebase`
- `@quatrain/auth-firebase`
- `@quatrain/messaging-firebase`

It ensures that the `firebase-admin` SDK is initialized exactly once, avoiding conflicts and simplifying your app's startup sequence.

## Installation

```bash
npm install @quatrain/cloudwrapper-firebase firebase-admin
# or
yarn add @quatrain/cloudwrapper-firebase firebase-admin
```

## Configuration

Provide the standard Firebase Admin service account configuration.

```typescript
import { CloudWrapper } from '@quatrain/cloudwrapper'
import { FirebaseWrapper } from '@quatrain/cloudwrapper-firebase'

const firebaseEnv = new FirebaseWrapper({
    config: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
    }
})

CloudWrapper.addAdapter('firebase', firebaseEnv, true)
```

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
