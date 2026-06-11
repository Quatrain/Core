# @quatrain/messaging-firebase

The Firebase Cloud Messaging (FCM) adapter for `@quatrain/messaging`.

## Introduction

Firebase Cloud Messaging is an industry-standard solution for sending push notifications to iOS, Android, and Web clients. This adapter implements the Quatrain messaging interface using the Firebase Admin SDK.

## Installation

```bash
npm install @quatrain/messaging-firebase firebase-admin
# or
yarn add @quatrain/messaging-firebase firebase-admin
```

## Configuration

Register the adapter using your Firebase service account credentials.

```typescript
import { Messaging } from '@quatrain/messaging'
import { FirebaseMessagingAdapter } from '@quatrain/messaging-firebase'

const fcmAdapter = new FirebaseMessagingAdapter({
    config: {
        projectId: 'your-project-id',
        clientEmail: 'firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
    }
})

Messaging.addAdapter('push', fcmAdapter, true)
```

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
