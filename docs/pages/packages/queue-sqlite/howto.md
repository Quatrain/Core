# How-To Guide: Working with @quatrain/queue-sqlite

This guide covers common integration scenarios and recipes for using `@quatrain/queue-sqlite`.

---

## 1. Initializing and Registering the Queue

To use the queue, initialize the `SQLiteQueueAdapter` and add it to the static `Queue` registry.

```typescript
import { Queue } from '@quatrain/queue';
import { SQLiteQueueAdapter } from '@quatrain/queue-sqlite';

// Register the SQLite queue adapter as the default queue
Queue.addQueue(
   new SQLiteQueueAdapter({
      config: { database: './database.sqlite' }
   }),
   'default',
   true
);
```

---

## 2. Dispatching a Task

To dispatch a task payload to the queue, use `Queue.getQueue().send()`.

```typescript
import { Queue } from '@quatrain/queue';

async function dispatchIngestion(filePath: string) {
   const adapter = Queue.getQueue();
   const taskId = await adapter.send({
      type: 'pdf',
      name: 'annual_report.pdf',
      tempFilePath: filePath,
   }, 'ingestion');

   console.log(`Task dispatched with ID: ${taskId}`);
}
```

---

## 3. Registering a Queue Listener

A listener polls the SQLite queue for pending tasks, marks them as processing, calls the handler, and records completion or failure.

```typescript
import { Queue } from '@quatrain/queue';

function startTaskWorker() {
   const adapter = Queue.getQueue();
   
   adapter.listen('ingestion', async (task: any, options: { updateProgress: Function }) => {
      console.log(`Processing task: ${task.name}`);
      
      // Update task progress dynamically
      await options.updateProgress(25);
      
      // Perform work...
      await options.updateProgress(100);
   });
}
```

---

## 4. Querying and Managing Tasks

You can query the status of all queued tasks, delete finished tasks, or retry failed ones directly from the adapter:

```typescript
import { Queue } from '@quatrain/queue';
import { SQLiteQueueAdapter } from '@quatrain/queue-sqlite';

async function manageQueue() {
   const adapter = Queue.getQueue<SQLiteQueueAdapter>();

   // Get all tasks sorted by creation date
   const tasks = await adapter.getTasks('ingestion');
   console.log('Active Tasks:', tasks);

   // Retry a failed task
   const wasRetried = await adapter.retryTask('failed-task-uuid');
   if (wasRetried) console.log('Task set back to pending.');

   // Delete a completed or failed task
   await adapter.deleteTask('completed-task-uuid');
}
```
