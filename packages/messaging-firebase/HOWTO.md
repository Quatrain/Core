# How To: Using @quatrain/messaging-firebase

This guide demonstrates how to send FCM push notifications.

## Table of Contents
1. [Sending to a Single Device](#1-sending-to-a-single-device)
2. [Sending to a Topic](#2-sending-to-a-topic)

---

## 1. Sending to a Single Device

FCM uses device tokens to target specific instances of your app.

```typescript
import { Messaging } from '@quatrain/messaging'

async function sendDirectPush(token: string) {
    const fcm = Messaging.getAdapter('push')
    
    await fcm.send({
        token: token,
        notification: {
            title: 'New Message',
            body: 'You have a new message from Alice'
        }
    })
}
```

## 2. Sending to a Topic

You can also broadcast messages to any user subscribed to a specific FCM topic.

```typescript
import { Messaging } from '@quatrain/messaging'

async function broadcastUpdate() {
    const fcm = Messaging.getAdapter('push')
    
    await fcm.send({
        topic: 'news_updates',
        notification: {
            title: 'Breaking News',
            body: 'Check out the latest features in v2.0!'
        }
    })
}
```
