# @quatrain/queue-postgres

PostgreSQL adapter for [`@quatrain/queue`](../queue): durable tasks in a table, no broker to run.

## Installation

```bash
yarn add @quatrain/queue-postgres
```

## Features

- **Durable**: tasks survive restarts; their status, progress, attempts and error are queryable.
- **Safe with several workers**: tasks are claimed with `FOR UPDATE SKIP LOCKED`, so processes on
  one or many machines can listen on the same topic without processing a task twice concurrently.
- **Per-listener concurrency**, oldest task first.
- **Recovery**: `retryTask` for a failed task, `requeueStale` for tasks abandoned by a stopped worker.
- **Graceful stop**: a listener (or `close()`) waits for the tasks being processed.

Delivery is *at least once*: a task whose worker dies is processed again after `requeueStale`.
Make handlers idempotent.

## Configuration

| Key | Required | Description |
|---|---|---|
| `connectionString` | one of | `postgres://user:password@host:5432/database` |
| `pool` | one of | Existing `pg` pool to reuse; the adapter never closes it |
| `poolOptions` | no | Extra `pg` pool options (ssl, max, …) |
| `pollIntervalMs` | no | Delay between two polls of a listener (default 1000) |
| `ensureSchema` | no | Create the table and indexes on first use (default `true`) |

## Schema

One table, `queue_messages`, defined in [`sql/queue_messages.sql`](sql/queue_messages.sql)
(idempotent). Set `ensureSchema: false` to apply it with your own migration tooling.

## API

| Method | Role |
|---|---|
| `send(data, topic)` | Stores a task, returns its identifier |
| `listen(topic, handler, { concurrency })` | Processes pending tasks; returns `{ stop() }` |
| `getTasks(topic?, limit?)` | Lists tasks, newest first, payload fields exposed at the top level |
| `retryTask(id)` | Puts a failed or stuck task back in the queue |
| `requeueStale(olderThanMs, topic?)` | Puts back tasks left in processing for too long |
| `deleteTask(id)`, `updateProgress(id, progress)` | Housekeeping |
| `close()` | Stops listeners, waits for running tasks, closes its own pool |

See [HOWTO.md](HOWTO.md).

## Tests

Integration tests need a database and are skipped without one:

```bash
QUEUE_POSTGRES_TEST_URL=postgres://postgres@127.0.0.1:5432/queue_test yarn jest packages/queue-postgres
```

## License

AGPL-3.0-only
