import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { AbstractQueueAdapter } from '@quatrain/queue'
import { Pool, type PoolConfig } from 'pg'

/**
 * Configuration of the PostgreSQL queue adapter.
 */
export interface PostgresQueueConfig {
   /** Connection string, e.g. `postgres://user:password@host:5432/database`. */
   connectionString?: string
   /** Existing pool to reuse; it is then never closed by the adapter. */
   pool?: Pool
   /** Extra `pg` pool options (ssl, max, …), ignored when `pool` is given. */
   poolOptions?: PoolConfig
   /** Delay between two polls of a listener, in milliseconds (default 1000). */
   pollIntervalMs?: number
   /** Create the table and indexes on first use (default true). */
   ensureSchema?: boolean
}

/**
 * Status of a queued task.
 */
export type QueueTaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * A queued task as returned by {@link PostgresQueueAdapter.getTasks}.
 * The payload fields are also exposed at the top level; the fields below always win.
 */
export interface QueueTask {
   id: string
   topic: string
   status: QueueTaskStatus
   payload: any
   progress: number
   attempts: number
   error: string | null
   createdAt: string
   startedAt: string | null
   completedAt: string | null
   [payloadField: string]: any
}

/**
 * Handle returned by {@link PostgresQueueAdapter.listen}.
 */
export interface QueueListener {
   topic: string
   /** Stops polling and resolves once the tasks being processed are finished. */
   stop: () => Promise<void>
}

/**
 * Helpers handed to a task handler.
 */
export interface QueueTaskContext {
   /** Identifier of the task being processed. */
   id: string
   /** Number of times the task has been claimed, this one included. */
   attempts: number
   /** Records the progress of the task (0 to 100). */
   updateProgress: (progress: number) => Promise<void>
}

/** DDL of the queue table, shipped with the package. */
const SCHEMA_SQL_PATH = join(__dirname, '..', 'sql', 'queue_messages.sql')

/**
 * Queue adapter storing tasks in PostgreSQL.
 *
 * Tasks are durable and claimed with `FOR UPDATE SKIP LOCKED`, so several
 * workers (processes or machines) can listen on the same topic without ever
 * processing a task twice concurrently.
 */
export class PostgresQueueAdapter extends AbstractQueueAdapter {
   protected _pool: Pool
   protected _ownsPool: boolean
   protected _pollIntervalMs: number
   protected _schemaReady?: Promise<void>
   protected _listeners = new Set<QueueListener>()

   constructor(params: { config: PostgresQueueConfig; topic?: string }) {
      super(params as any)
      const config = params?.config || {}
      if (config.pool) {
         this._pool = config.pool
         this._ownsPool = false
      } else {
         if (!config.connectionString) {
            throw new Error('[PostgresQueueAdapter] "connectionString" or "pool" is required.')
         }
         this._pool = new Pool({ ...config.poolOptions, connectionString: config.connectionString })
         this._ownsPool = true
      }
      this._pollIntervalMs = config.pollIntervalMs ?? 1000
      if (config.ensureSchema === false) {
         this._schemaReady = Promise.resolve()
      }
   }

   /**
    * Creates the queue table and its indexes when missing (once per adapter).
    */
   public ensureSchema(): Promise<void> {
      if (!this._schemaReady) {
         this._schemaReady = this._pool
            .query(readFileSync(SCHEMA_SQL_PATH, 'utf-8'))
            .then(() => undefined)
            .catch((error) => {
               this._schemaReady = undefined
               throw error
            })
      }
      return this._schemaReady
   }

   /**
    * Stores a task and returns its identifier.
    *
    * @param data - JSON-serialisable payload.
    * @param topic - Queue name.
    */
   async send(data: any, topic: string): Promise<string> {
      await this.ensureSchema()
      const id = randomUUID()
      await this._pool.query(`INSERT INTO queue_messages (id, topic, status, payload) VALUES ($1, $2, 'pending', $3::jsonb)`, [
         id,
         topic,
         JSON.stringify(data ?? null),
      ])
      return id
   }

   /**
    * Processes the pending tasks of a topic, oldest first.
    *
    * @param topic - Queue name.
    * @param handler - Called with the payload and a {@link QueueTaskContext}; a rejection marks the task as failed.
    * @param params - `concurrency`: number of tasks processed at the same time by this listener (default 1).
    */
   listen(topic: string, handler: Function, params?: { concurrency?: number; gpu?: boolean }): QueueListener {
      const concurrency = Math.max(1, params?.concurrency ?? 1)
      const running = new Set<Promise<void>>()
      let stopped = false
      let timer: NodeJS.Timeout | undefined

      const poll = async (): Promise<void> => {
         try {
            await this.ensureSchema()
            while (!stopped && running.size < concurrency) {
               const task = await this.claim(topic)
               if (!task) {
                  break
               }
               const run = this.process(task, handler).finally(() => {
                  running.delete(run)
               })
               running.add(run)
            }
         } catch {
            // Database unreachable: keep polling, the next attempt may succeed.
         }
         if (!stopped) {
            timer = setTimeout(poll, this._pollIntervalMs)
         }
      }

      const listener: QueueListener = {
         topic,
         stop: async () => {
            stopped = true
            if (timer) {
               clearTimeout(timer)
            }
            this._listeners.delete(listener)
            await Promise.all(running)
         },
      }
      this._listeners.add(listener)
      timer = setTimeout(poll, 0)
      return listener
   }

   /**
    * Lists tasks, newest first.
    *
    * @param topic - Restrict to one queue.
    * @param limit - Maximum number of tasks (default 500).
    */
   async getTasks(topic?: string, limit = 500): Promise<QueueTask[]> {
      await this.ensureSchema()
      const { rows } = topic
         ? await this._pool.query(`SELECT * FROM queue_messages WHERE topic = $1 ORDER BY created_at DESC, id LIMIT $2`, [topic, limit])
         : await this._pool.query(`SELECT * FROM queue_messages ORDER BY created_at DESC, id LIMIT $1`, [limit])
      return rows.map((row) => ({
         ...(row.payload !== null && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {}),
         id: row.id,
         topic: row.topic,
         status: row.status,
         payload: row.payload,
         progress: row.progress,
         attempts: row.attempts,
         error: row.error,
         createdAt: toIso(row.created_at) as string,
         startedAt: toIso(row.started_at),
         completedAt: toIso(row.completed_at),
      }))
   }

   /**
    * Puts a failed or stuck task back in the queue.
    *
    * @returns `false` when the task does not exist or is currently completed.
    */
   async retryTask(taskId: string): Promise<boolean> {
      await this.ensureSchema()
      const result = await this._pool.query(
         `UPDATE queue_messages SET status = 'pending', progress = 0, error = NULL, started_at = NULL, completed_at = NULL
          WHERE id = $1 AND status IN ('failed', 'processing')`,
         [taskId]
      )
      return (result.rowCount ?? 0) > 0
   }

   /**
    * Puts back in the queue the tasks left in processing by a worker that stopped.
    *
    * @param olderThanMs - Minimum time since the task was claimed.
    * @param topic - Restrict to one queue.
    * @returns Number of tasks put back.
    */
   async requeueStale(olderThanMs: number, topic?: string): Promise<number> {
      await this.ensureSchema()
      const result = await this._pool.query(
         `UPDATE queue_messages SET status = 'pending', progress = 0, started_at = NULL
          WHERE status = 'processing' AND started_at < NOW() - ($1::double precision * INTERVAL '1 millisecond')
            AND ($2::text IS NULL OR topic = $2)`,
         [olderThanMs, topic ?? null]
      )
      return result.rowCount ?? 0
   }

   /**
    * Deletes a task.
    *
    * @returns `false` when the task does not exist.
    */
   async deleteTask(taskId: string): Promise<boolean> {
      await this.ensureSchema()
      const result = await this._pool.query(`DELETE FROM queue_messages WHERE id = $1`, [taskId])
      return (result.rowCount ?? 0) > 0
   }

   /**
    * Records the progress of a task (clamped to 0..100).
    */
   async updateProgress(taskId: string, progress: number): Promise<void> {
      const value = Math.min(100, Math.max(0, Math.round(progress)))
      await this._pool.query(`UPDATE queue_messages SET progress = $2 WHERE id = $1`, [taskId, value])
   }

   /**
    * Stops every listener, waits for running tasks, then closes the pool when the adapter created it.
    */
   async close(): Promise<void> {
      await Promise.all(Array.from(this._listeners).map((listener) => listener.stop()))
      if (this._ownsPool) {
         await this._pool.end()
      }
   }

   /**
    * Claims the oldest pending task of a topic; concurrent workers skip rows already locked.
    */
   protected async claim(topic: string): Promise<{ id: string; payload: any; attempts: number } | null> {
      const { rows } = await this._pool.query(
         `UPDATE queue_messages SET status = 'processing', started_at = NOW(), attempts = attempts + 1
          WHERE id = (
             SELECT id FROM queue_messages
             WHERE topic = $1 AND status = 'pending'
             ORDER BY created_at, id
             FOR UPDATE SKIP LOCKED
             LIMIT 1
          )
          RETURNING id, payload, attempts`,
         [topic]
      )
      return rows[0] ?? null
   }

   /**
    * Runs the handler for a claimed task and records its outcome.
    * A task that was retried or deleted meanwhile is left as it is.
    */
   protected async process(task: { id: string; payload: any; attempts: number }, handler: Function): Promise<void> {
      const context: QueueTaskContext = {
         id: task.id,
         attempts: task.attempts,
         updateProgress: (progress: number) => this.updateProgress(task.id, progress),
      }
      try {
         await handler(task.payload, context)
         await this._pool.query(
            `UPDATE queue_messages SET status = 'completed', progress = 100, completed_at = NOW() WHERE id = $1 AND status = 'processing'`,
            [task.id]
         )
      } catch (error: any) {
         await this._pool
            .query(`UPDATE queue_messages SET status = 'failed', error = $2, completed_at = NOW() WHERE id = $1 AND status = 'processing'`, [
               task.id,
               String(error?.message || 'Unknown error').slice(0, 2000),
            ])
            .catch(() => undefined)
      }
   }
}

/**
 * Serialises a timestamp column.
 */
function toIso(value: Date | null): string | null {
   return value ? value.toISOString() : null
}

export default PostgresQueueAdapter
