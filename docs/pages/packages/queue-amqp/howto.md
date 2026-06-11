# How To: Using @quatrain/queue-amqp

This guide explains AMQP-specific behaviors and configurations.

## Table of Contents
1. [Automatic Reconnection](#1-automatic-reconnection)
2. [Concurrency Settings](#2-concurrency-settings)

---

## 1. Automatic Reconnection

Unlike HTTP-based queues, AMQP relies on persistent TCP connections. The `@quatrain/queue-amqp` adapter is built to automatically attempt reconnection if the broker goes down or the connection drops. You do not need to wrap your `send` or `listen` calls in retry loops; the adapter handles channel recovery internally.

## 2. Concurrency Settings

When listening to a RabbitMQ queue, you can control how many messages your worker pulls concurrently using the `prefetch` or `concurrency` option.

```typescript
import { Queue } from '@quatrain/queue'

async function setupWorker() {
    const queue = Queue.getAdapter('rabbitmq')
    
    // The handler will receive up to 5 messages concurrently
    await queue.listen('video-rendering', async (payload) => {
        await processVideo(payload)
        return true
    }, { concurrency: 5 })
}
```
