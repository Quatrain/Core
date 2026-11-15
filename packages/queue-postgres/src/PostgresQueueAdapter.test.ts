import { Pool } from 'pg'
import { PostgresQueueAdapter, type QueueTaskContext } from './PostgresQueueAdapter'

/**
 * Integration tests: they need a PostgreSQL database and are skipped without one.
 *   QUEUE_POSTGRES_TEST_URL=postgres://postgres@127.0.0.1:5432/queue_test yarn jest packages/queue-postgres
 */
const URL = process.env.QUEUE_POSTGRES_TEST_URL
const suite = URL ? describe : describe.skip

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function until(condition: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
   const deadline = Date.now() + timeoutMs
   while (!(await condition())) {
      if (Date.now() > deadline) {
         throw new Error('Condition not met in time')
      }
      await wait(20)
   }
}

describe('PostgresQueueAdapter configuration', () => {
   it('requires a connection string or a pool', () => {
      expect(() => new PostgresQueueAdapter({ config: {} })).toThrow(/"connectionString" or "pool" is required/)
   })
})

suite('PostgresQueueAdapter', () => {
   let pool: Pool
   let queue: PostgresQueueAdapter
   const adapters: PostgresQueueAdapter[] = []

   const adapter = () => {
      const created = new PostgresQueueAdapter({ config: { pool, pollIntervalMs: 20 } })
      adapters.push(created)
      return created
   }

   beforeAll(async () => {
      pool = new Pool({ connectionString: URL })
      await pool.query('DROP TABLE IF EXISTS queue_messages')
   })

   beforeEach(async () => {
      queue = adapter()
      await queue.ensureSchema()
      await pool.query('TRUNCATE queue_messages')
   })

   afterEach(async () => {
      await Promise.all(adapters.splice(0).map((created) => created.close()))
   })

   afterAll(async () => {
      await pool.end()
   })

   it('creates its schema idempotently', async () => {
      await adapter().ensureSchema()
      const { rows } = await pool.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'queue_messages' ORDER BY indexname`)
      expect(rows.map((row) => row.indexname)).toEqual(['queue_messages_pending_idx', 'queue_messages_pkey', 'queue_messages_processing_idx'])
   })

   it('stores a task and lists it with its payload fields', async () => {
      const id = await queue.send({ name: 'report.pdf', type: 'pdf', status: 'spoofed' }, 'ingestion')
      await queue.send({ other: true }, 'emails')

      const tasks = await queue.getTasks('ingestion')
      expect(tasks).toHaveLength(1)
      expect(tasks[0]).toMatchObject({ id, topic: 'ingestion', status: 'pending', progress: 0, attempts: 0, error: null, name: 'report.pdf', type: 'pdf' })
      expect(tasks[0].payload).toEqual({ name: 'report.pdf', type: 'pdf', status: 'spoofed' })
      expect(typeof tasks[0].createdAt).toBe('string')
      expect(await queue.getTasks()).toHaveLength(2)
   })

   it('processes tasks oldest first and records progress and completion', async () => {
      const seen: string[] = []
      const first = await queue.send({ n: 'first' }, 'ingestion')
      await queue.send({ n: 'second' }, 'ingestion')

      queue.listen('ingestion', async (payload: any, context: QueueTaskContext) => {
         seen.push(payload.n)
         expect(context.attempts).toBe(1)
         await context.updateProgress(250)
      })
      await until(async () => (await queue.getTasks('ingestion')).every((task) => task.status === 'completed'))

      expect(seen).toEqual(['first', 'second'])
      const done = (await queue.getTasks('ingestion')).find((task) => task.id === first)
      expect(done).toMatchObject({ status: 'completed', progress: 100, attempts: 1 })
      expect(done?.startedAt).not.toBeNull()
      expect(done?.completedAt).not.toBeNull()
   })

   it('marks a task as failed with the error message and can retry it', async () => {
      const id = await queue.send({ n: 1 }, 'ingestion')
      let attempts = 0
      queue.listen('ingestion', async () => {
         attempts++
         if (attempts === 1) {
            throw new Error('model unavailable')
         }
      })
      await until(async () => (await queue.getTasks('ingestion'))[0].status === 'failed')
      expect((await queue.getTasks('ingestion'))[0]).toMatchObject({ status: 'failed', error: 'model unavailable' })

      expect(await queue.retryTask(id)).toBe(true)
      await until(async () => (await queue.getTasks('ingestion'))[0].status === 'completed')
      expect((await queue.getTasks('ingestion'))[0]).toMatchObject({ attempts: 2, error: null })
      expect(await queue.retryTask(id)).toBe(false)
      expect(await queue.retryTask('00000000-0000-0000-0000-000000000000')).toBe(false)
   })

   it('never hands the same task to two workers', async () => {
      const total = 40
      for (let i = 0; i < total; i++) {
         await queue.send({ i }, 'ingestion')
      }
      const processed: number[] = []
      const handler = async (payload: any) => {
         processed.push(payload.i)
         await wait(5)
      }
      queue.listen('ingestion', handler, { concurrency: 4 })
      adapter().listen('ingestion', handler, { concurrency: 4 })
      adapter().listen('ingestion', handler, { concurrency: 4 })

      await until(async () => (await queue.getTasks('ingestion')).every((task) => task.status === 'completed'), 15000)
      expect(processed).toHaveLength(total)
      expect(new Set(processed).size).toBe(total)
      expect((await queue.getTasks('ingestion')).every((task) => task.attempts === 1)).toBe(true)
   })

   it('respects the listener concurrency', async () => {
      for (let i = 0; i < 6; i++) {
         await queue.send({ i }, 'ingestion')
      }
      let running = 0
      let peak = 0
      queue.listen(
         'ingestion',
         async () => {
            running++
            peak = Math.max(peak, running)
            await wait(40)
            running--
         },
         { concurrency: 2 }
      )
      await until(async () => (await queue.getTasks('ingestion')).every((task) => task.status === 'completed'))
      expect(peak).toBe(2)
   })

   it('puts back in the queue the tasks abandoned by a stopped worker', async () => {
      const id = await queue.send({ n: 1 }, 'ingestion')
      await pool.query(`UPDATE queue_messages SET status = 'processing', started_at = NOW() - INTERVAL '10 minutes', attempts = 1 WHERE id = $1`, [id])
      const fresh = await queue.send({ n: 2 }, 'ingestion')
      await pool.query(`UPDATE queue_messages SET status = 'processing', started_at = NOW(), attempts = 1 WHERE id = $1`, [fresh])

      expect(await queue.requeueStale(5 * 60_000, 'emails')).toBe(0)
      expect(await queue.requeueStale(5 * 60_000)).toBe(1)
      const tasks = await queue.getTasks('ingestion')
      expect(tasks.find((task) => task.id === id)?.status).toBe('pending')
      expect(tasks.find((task) => task.id === fresh)?.status).toBe('processing')
   })

   it('stop waits for the running task and leaves the others pending', async () => {
      await queue.send({ n: 1 }, 'ingestion')
      await queue.send({ n: 2 }, 'ingestion')
      let finished = 0
      const listener = queue.listen('ingestion', async () => {
         await wait(80)
         finished++
      })
      await until(async () => (await queue.getTasks('ingestion')).some((task) => task.status === 'processing'))
      await listener.stop()
      expect(finished).toBe(1)
      await wait(100)
      expect((await queue.getTasks('ingestion')).map((task) => task.status).sort()).toEqual(['completed', 'pending'])
   })

   it('deletes a task', async () => {
      const id = await queue.send({ n: 1 }, 'ingestion')
      expect(await queue.deleteTask(id)).toBe(true)
      expect(await queue.deleteTask(id)).toBe(false)
      expect(await queue.getTasks()).toEqual([])
   })
})
