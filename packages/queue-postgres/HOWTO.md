# @quatrain/queue-postgres — HOWTO

## Register the adapter

```ts
import { Queue } from '@quatrain/queue'
import { PostgresQueueAdapter } from '@quatrain/queue-postgres'

const queue = new PostgresQueueAdapter({ config: { connectionString: process.env.DATABASE_URL } })
Queue.addQueue(queue, 'default', true)
```

## Send and process tasks

```ts
const id = await queue.send({ document: 'report.pdf' }, 'ingestion')

const listener = queue.listen(
   'ingestion',
   async (payload, context) => {
      await context.updateProgress(50)
      // … work; throwing marks the task as failed with the error message
   },
   { concurrency: 2 }
)

process.on('SIGTERM', async () => {
   await queue.close() // waits for the tasks being processed
   process.exit(0)
})
```

Run the listener in a worker process separate from the web process when tasks are long.

## Recover after a crash

A worker that dies leaves its tasks in `processing`. Put them back at start-up, with a delay
longer than your longest task:

```ts
await queue.requeueStale(15 * 60_000, 'ingestion')
```

Handlers must be idempotent: such a task runs a second time.

## Separate tenants

Carry the tenant in the payload and check it in the handler, or use one topic per tenant
(`ingestion:<tenant>`). The adapter itself knows nothing about tenants.
