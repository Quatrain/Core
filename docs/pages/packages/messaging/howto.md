# How To: Using @quatrain/messaging

This guide covers the core operations for sending notifications.

## Table of Contents
1. [Registering Messaging Adapters](#1-registering-messaging-adapters)
2. [Sending Messages](#2-sending-messages)

---

## 1. Registering Messaging Adapters

You can register different adapters for different communication channels.

```typescript
import { Messaging } from '@quatrain/messaging'
import { FirebaseMessagingAdapter } from '@quatrain/messaging-firebase'

const fcmAdapter = new FirebaseMessagingAdapter({
    config: { /* Firebase credentials */ }
})

// Register the push notification adapter
Messaging.addAdapter('push', fcmAdapter)
```

## 2. Sending Messages

To send a message, retrieve the appropriate adapter and construct your payload. The payload structure depends on the underlying provider, but standard fields (title, body, recipient) are generally normalized.

```typescript
import { Messaging } from '@quatrain/messaging'

async function notifyUser(deviceToken: string) {
    const pushAdapter = Messaging.getAdapter('push')
    
    await pushAdapter.send({
        to: deviceToken,
        notification: {
            title: 'Your order has shipped!',
            body: 'Track your package in the app.'
        },
        data: {
            orderId: '12345'
        }
    })
    
    console.log('Push notification sent.')
}
```
