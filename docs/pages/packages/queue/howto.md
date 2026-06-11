# How To: Using @quatrain/queue

This guide covers the core operations for interacting with message queues.

## Table of Contents
1. [Registering an Adapter](#1-registering-an-adapter)
2. [Sending Messages](#2-sending-messages)
3. [Listening for Messages](#3-listening-for-messages)

---

## 1. Registering an Adapter

Initialize your application by setting up the queue adapter.

```typescript
import { Queue } from '@quatrain/queue'
import { SqsAdapter } from '@quatrain/queue-aws'

const sqsAdapter = new SqsAdapter({
    config: {
        accesskey: process.env.AWS_KEY,
        secret: process.env.AWS_SECRET,
        region: 'eu-central-1',
        accountid: '1234567890'
    }
})

// Register the adapter and set it as default
Queue.addAdapter('default', sqsAdapter, true)
```

## 2. Sending Messages

You can send any serializable payload to a specific topic. The adapter will handle serialization automatically.

```typescript
import { Queue } from '@quatrain/queue'

async function dispatchJob() {
    const queue = Queue.getAdapter()
    
    const payload = {
        jobId: '12345',
        type: 'video_render',
        params: { resolution: '1080p' }
    }
    
    // send(data, topic)
    const messageId = await queue.send(payload, 'render-tasks')
    console.log(`Dispatched message ${messageId}`)
}
```

## 3. Listening for Messages

Typically, you will use `@quatrain/worker` to handle listening, but you can use the adapter directly. The handler must return `true` to acknowledge the message (so it gets deleted from the queue), or throw an error to trigger a retry.

```typescript
import { Queue } from '@quatrain/queue'

async function startListener() {
    const queue = Queue.getAdapter()
    
    await queue.listen('render-tasks', async (messageData) => {
        console.log('Received:', messageData)
        
        try {
            // ... process the job ...
            return true // Acknowledge and delete
        } catch (err) {
            console.error('Job failed')
            return false // Keeps the message in the queue/DLQ
        }
    })
}
```
