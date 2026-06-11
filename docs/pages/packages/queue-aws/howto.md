# How To: Using @quatrain/queue-aws

This guide highlights specific features of the SQS adapter.

## Table of Contents
1. [Long Polling](#1-long-polling)
2. [Message Deletion](#2-message-deletion)

---

## 1. Long Polling

When you call `listen()` using the SQS adapter, it automatically utilizes long polling (up to 20 seconds) to reduce the number of empty API requests and lower costs.

```typescript
import { Queue } from '@quatrain/queue'

async function consume() {
    const queue = Queue.getAdapter('sqs')
    
    // This will open a long-polling connection to the specified queue URL
    await queue.listen('MyQueueTopic', async (msg) => {
        console.log('Received SQS message:', msg)
        return true
    })
}
```

## 2. Message Deletion

In SQS, messages must be explicitly deleted using their `ReceiptHandle` after processing. The `listen()` wrapper handles this automatically: if your handler returns `true` (or a truthy value, or resolves successfully), the adapter will send the `DeleteMessageCommand` for you. If it throws an error, the message remains hidden until the visibility timeout expires, after which it becomes available again.
