# How To: Using @quatrain/cloudwrapper-firebase

This guide shows how the wrapper simplifies Firebase initialization.

## Table of Contents
1. [Accessing the raw SDK](#1-accessing-the-raw-sdk)

---

## 1. Accessing the raw SDK

The wrapper initializes the `firebase-admin` app. If you ever need to perform raw operations that aren't covered by Quatrain abstractions, you can access the initialized app directly.

```typescript
import { CloudWrapper } from '@quatrain/cloudwrapper'
import * as admin from 'firebase-admin'

async function rawFirebaseOperation() {
    // Ensure the wrapper is initialized first
    const wrapper = CloudWrapper.getAdapter()
    
    // You can now safely use the admin SDK without calling initializeApp
    const app = admin.app()
    console.log(`Using Firebase App: ${app.name}`)
}
```
