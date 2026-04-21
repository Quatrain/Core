# How To: Using @quatrain/queue-gcp

This guide explains Pub/Sub specific behaviors.

## Table of Contents
1. [Topics vs Subscriptions](#1-topics-vs-subscriptions)

---

## 1. Topics vs Subscriptions

In GCP Pub/Sub, you publish to a **Topic**, but you listen to a **Subscription**.

When using `@quatrain/queue-gcp`:
- `send(data, target)` expects `target` to be the name of a **Topic**.
- `listen(target, handler)` expects `target` to be the name of a **Subscription**.

It is your responsibility to ensure that the Subscription you are listening to is bound to the Topic you are publishing to in your GCP Console or Terraform scripts.

```typescript
import { Queue } from '@quatrain/queue'

async function run() {
    const pubsub = Queue.getAdapter('pubsub')
    
    // Send to TOPIC
    await pubsub.send({ action: 'process' }, 'worker-tasks-topic')
    
    // Listen to SUBSCRIPTION
    await pubsub.listen('worker-tasks-subscription', async (data) => {
        console.log(data)
        return true // Acknowledges the message
    })
}
```
