---
type: pattern
title: Asynchronous Event Streaming
description: Asynchronous task distribution, background queue workers, and event streaming with Queue.addQueue() from @quatrain/queue.
tags:
  - quatrain
  - queue
  - workers
  - amqp
  - rabbitmq
  - sqlite
timestamp: 2026-09-17T00:00:00.000Z
category: queues-and-events
status: active
---

# Asynchronous Event Streaming

Quatrain applications offload long-running operations (PDF generation, telemetry ingestion, email dispatch, AI embeddings) to background workers using `@quatrain/queue`.

---

## 🎯 Architectural Principles

1. **Queue Registry**: Message queues are configured and registered via `Queue.addQueue(adapter, alias, setDefault)`.
2. **Unified Dispatch**: Code dispatches messages using `adapter.send(payload, topic)`, returning the unique message identifier.
3. **Controlled Concurrency**: Workers listen to messages with `adapter.listen(topic, handler, { concurrency })`.

---

## ⚖️ Implementation Patterns

### 1. Registering an AMQP / RabbitMQ Adapter
```typescript
import { Queue } from "@quatrain/queue";
import { AmqpQueueAdapter } from "@quatrain/queue-amqp";

const amqpAdapter = new AmqpQueueAdapter({
  alias: "rabbit-default",
  config: {
    host: process.env.RABBITMQ_HOST || "localhost",
    port: parseInt(process.env.RABBITMQ_PORT || "5672", 10),
    user: process.env.RABBITMQ_USER || "guest",
    password: process.env.RABBITMQ_PASSWORD || "guest",
  },
});

// Register as the default queue backend
Queue.addQueue(amqpAdapter, "amqp", true);
```

---

### 2. Dispatching Tasks & Consuming Messages
```typescript
import { Queue } from "@quatrain/queue";

interface IngestionTask {
  documentId: string;
  sourceUrl: string;
}

// Producer: Dispatch task to queue topic
export async function enqueueDocument(task: IngestionTask): Promise<string> {
  const queue = Queue.getQueue(); // Default queue adapter
  const messageId = await queue.send(task, "document_tasks");
  return messageId;
}

// Consumer: Background worker listener
export async function startWorker(): Promise<void> {
  const queue = Queue.getQueue();

  await queue.listen(
    "document_tasks",
    async (rawPayload: string) => {
      const task: IngestionTask = JSON.parse(rawPayload);
      console.log(`Processing document ${task.documentId} from ${task.sourceUrl}...`);
      // Perform background work...
    },
    { concurrency: 5 } // Concurrency limit
  );
}
```
