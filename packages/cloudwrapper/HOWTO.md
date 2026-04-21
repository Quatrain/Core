# How To: Using @quatrain/cloudwrapper

This guide demonstrates how to initialize an entire cloud environment with a single wrapper.

## Table of Contents
1. [Initializing a Cloud Environment](#1-initializing-a-cloud-environment)

---

## 1. Initializing a Cloud Environment

Instead of importing and configuring `Backend`, `Storage`, and `Auth` separately, you just configure the wrapper.

```typescript
import { CloudWrapper } from '@quatrain/cloudwrapper'
import { FirebaseWrapper } from '@quatrain/cloudwrapper-firebase'

const firebaseEnv = new FirebaseWrapper({
    config: {
        projectId: 'my-project',
        clientEmail: 'service@account.com',
        privateKey: '-----BEGIN PRIVATE KEY-----...'
    }
})

// This single call initializes everything
CloudWrapper.addAdapter('default', firebaseEnv, true)

// You can now immediately use the subsystems:
// import { Backend } from '@quatrain/backend'
// Backend.getAdapter() // Returns the configured FirestoreAdapter
```
