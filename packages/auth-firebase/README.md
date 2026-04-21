# @quatrain/auth-firebase

The Firebase Authentication adapter for `@quatrain/auth`.

## Introduction

Firebase Authentication provides backend services to authenticate users. This adapter implements the Quatrain Auth interface using the `firebase-admin` SDK to verify JWTs and manage users.

## Installation

```bash
npm install @quatrain/auth-firebase firebase-admin
# or
yarn add @quatrain/auth-firebase firebase-admin
```

## Configuration

Register the adapter using your Firebase service account credentials.

```typescript
import { Auth } from '@quatrain/auth'
import { FirebaseAuthAdapter } from '@quatrain/auth-firebase'

const firebaseAuth = new FirebaseAuthAdapter({
    config: {
        projectId: 'your-project-id',
        clientEmail: 'firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n'
    }
})

Auth.addAdapter('firebase', firebaseAuth, true)
```

## License

AGPL-3.0-only
