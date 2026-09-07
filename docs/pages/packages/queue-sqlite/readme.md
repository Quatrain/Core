# @quatrain/queue-sqlite

SQLite Task Queue Adapter for the `@quatrain/queue` namespace.

This package provides a robust local-first persistent queue adapter using SQLite. It is designed to queue tasks locally in memory or write them persistently on disk, processing them sequentially or concurrently under unprivileged user execution constraints.

## Features

- **Local Persistence**: Save tasks to a local SQLite database (`:memory:` or persistent file).
- **Concurrency Locking**: Utilizes transactions and `BEGIN IMMEDIATE` statements to prevent multi-process locking conflicts.
- **Task Lifecycle Management**: Supports progress reporting, task retries, deletion, and query utilities.
- **Agnostic Interface**: Conforms strictly to Quatrain Core's `AbstractQueueAdapter` specification.

## Installation

```bash
yarn add @quatrain/queue-sqlite
```

## Configuration

Initialize the adapter with a path to your SQLite database file:

```typescript
import { Queue } from '@quatrain/queue';
import { SQLiteQueueAdapter } from '@quatrain/queue-sqlite';

const queueDbPath = './data/queue.sqlite';

Queue.addQueue(new SQLiteQueueAdapter({
   config: { database: queueDbPath }
}), 'default', true);
```
