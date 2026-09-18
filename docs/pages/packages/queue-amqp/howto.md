# How To: Using @quatrain/queue-amqp

This guide explains how to instantiate the AMQP (RabbitMQ) queue adapter, register it into the global `Queue` registry, and dispatch asynchronous messages honoring the **ObjectUri** system.

---

## Table of Contents
1. [Instantiation & Registry Registration](#1-instantiation--registry-registration)
2. [Default Queue vs Named Queue with ObjectUri](#2-default-queue-vs-named-queue-with-objecturi)
3. [Workers & Consumer Listeners](#3-workers--consumer-listeners)

---

## 1. Instantiation & Registry Registration

All queue and messaging adapters in Quatrain inherit from `AbstractQueueAdapter` and are registered into the global `Queue` registry.

```typescript
import { Queue } from '@quatrain/queue'
import { AmqpQueueAdapter } from '@quatrain/queue-amqp'

// 1. Instantiate the AMQP adapter (RabbitMQ)
const amqpAdapter = new AmqpQueueAdapter({
  config: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
    user: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest'
  }
})

// 2. Register into the Queue registry
// Setting setDefault = true makes this adapter the primary queue router
Queue.addQueue(amqpAdapter, 'amqp', true)
```

---

## 2. Default Queue vs Named Queue with ObjectUri

Quatrain represents asynchronous tasks and event destinations using the **ObjectUri** contract (`[queue:]topic/message_id`).

### A. Calling the Default Queue

Calling `Queue.getQueue()` without arguments resolves to the primary default queue:

```typescript
// Resolves the default queue adapter ('amqp')
const defaultQueue = Queue.getQueue()

// Dispatch an asynchronous job
await defaultQueue.send({ orderId: 'ord-101', amount: 49.99 }, 'orders')
```

### B. Calling a Specific Queue Respecting ObjectUri

When multiple queues are registered (e.g. primary `amqp` and local edge `sqlite`), you can inspect the task's `ObjectUri` to route messages dynamically:

```typescript
import { Queue } from '@quatrain/queue'
import { ObjectUri } from '@quatrain/core'

// Task URI specifying the AMQP queue target
const taskUri = new ObjectUri('amqp:video-renders/job-888')

// 1. Extract the target queue backend from the ObjectUri
const targetQueueAlias = taskUri.backend || Queue.defaultQueue // 'amqp'

// 2. Retrieve the adapter from the registry
const queue = Queue.getQueue(targetQueueAlias)

// 3. Dispatch to the target topic (taskUri.collection) using task identifier (taskUri.uid)
await queue.send(
  { jobId: taskUri.uid, action: 'transcode', quality: '1080p' },
  taskUri.collection // 'video-renders'
)
console.log(`Dispatched task ${taskUri.literal}`)
```

---

## 3. Workers & Consumer Listeners

```typescript
import { Queue } from '@quatrain/queue'

async function startWorker() {
  const queue = Queue.getQueue('amqp')

  await queue.listen('video-renders', async (payload) => {
    console.log(`Processing video render: ${payload.jobId}`)
    return true
  }, { concurrency: 5 })
}
```
