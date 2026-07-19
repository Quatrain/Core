import { AbstractQueueAdapter } from '@quatrain/queue';
import sqlite3, { Statement } from 'sqlite3';
import { open, Database } from 'sqlite';
import { randomUUID } from 'node:crypto';

export class SQLiteQueueAdapter extends AbstractQueueAdapter {
   protected _connection: undefined | Database<sqlite3.Database>;
   protected _dbPath: string;
   protected _intervals: Map<string, NodeJS.Timeout> = new Map();

   constructor(params: any) {
      super(params);
      this._dbPath = params.config?.database || ':memory:';
   }

   protected async _connect(): Promise<Database<sqlite3.Database>> {
      if (!this._connection) {
         this._connection = await open<sqlite3.Database, Statement>({
            filename: this._dbPath,
            driver: sqlite3.Database,
         });

         // Create the queue messages table if it doesn't exist
         await this._connection.exec(`
            CREATE TABLE IF NOT EXISTS queue_messages (
               id TEXT PRIMARY KEY,
               topic TEXT NOT NULL,
               status TEXT NOT NULL,
               payload TEXT NOT NULL,
               progress INTEGER DEFAULT 0,
               error TEXT,
               created_at TEXT NOT NULL,
               started_at TEXT,
               completed_at TEXT
            );
         `);
      }
      return this._connection;
   }

   /**
    * Dispatches a task payload into SQLite queue messages table.
    */
   async send(data: any, topic: string): Promise<string> {
      const connection = await this._connect();
      const messageId = randomUUID();
      const payloadStr = JSON.stringify(data);
      const now = new Date().toISOString();

      await connection.run(
         `INSERT INTO queue_messages (id, topic, status, payload, progress, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
         [messageId, topic, 'pending', payloadStr, 0, now]
      );

      return messageId;
   }

   /**
    * Listens for pending tasks on a topic and runs the handler.
    */
   listen(
      topic: string,
      handler: Function,
      params?: { concurrency?: number; gpu?: boolean }
   ): any {
      const interval = setInterval(async () => {
         try {
            const connection = await this._connect();

            // Simple lock using BEGIN IMMEDIATE to handle concurrent access safely
            await connection.run('BEGIN IMMEDIATE TRANSACTION');
            const message = await connection.get(
               `SELECT * FROM queue_messages WHERE topic = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1`,
               [topic]
            );

            if (!message) {
               await connection.run('COMMIT');
               return;
            }

            const startedAt = new Date().toISOString();
            await connection.run(
               `UPDATE queue_messages SET status = 'processing', started_at = ? WHERE id = ?`,
               [startedAt, message.id]
            );
            await connection.run('COMMIT');

            // Process outside transaction
            const payload = JSON.parse(message.payload);
            try {
               await handler(payload, {
                  updateProgress: async (progress: number) => {
                     await this.updateProgress(message.id, progress);
                  }
               });

               const completedAt = new Date().toISOString();
               await connection.run(
                  `UPDATE queue_messages SET status = 'completed', progress = 100, completed_at = ? WHERE id = ?`,
                  [completedAt, message.id]
               );
            } catch (err: any) {
               const failedAt = new Date().toISOString();
               await connection.run(
                  `UPDATE queue_messages SET status = 'failed', error = ?, completed_at = ? WHERE id = ?`,
                  [err.message || 'Unknown error', failedAt, message.id]
               );
            }
         } catch (e) {
            try {
               const connection = await this._connect();
               await connection.run('ROLLBACK');
            } catch {
               // ignore rollback failures if no tx active
            }
         }
      }, 1000);

      this._intervals.set(topic, interval);

      return {
         topic,
         stop: () => {
            clearInterval(interval);
            this._intervals.delete(topic);
         }
      };
   }

   /**
    * Returns all tasks in the queue sorted by created_at DESC.
    */
   async getTasks(topic?: string): Promise<any[]> {
      const connection = await this._connect();
      const sql = topic
         ? `SELECT * FROM queue_messages WHERE topic = ? ORDER BY created_at DESC`
         : `SELECT * FROM queue_messages ORDER BY created_at DESC`;
      const rows = await connection.all(sql, topic ? [topic] : []);
      return rows.map(row => {
         let parsedPayload: any = {};
         try {
            parsedPayload = JSON.parse(row.payload);
         } catch (e) {
            // ignore JSON parse errors
         }
         return {
            id: row.id,
            status: row.status,
            type: parsedPayload.type,
            name: parsedPayload.name,
            progress: row.progress,
            error: row.error,
            createdAt: row.created_at,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            tempFilePath: parsedPayload.tempFilePath,
            url: parsedPayload.url,
            textContent: parsedPayload.textContent,
            category: parsedPayload.category,
            contextNote: parsedPayload.contextNote,
            crawlDepth: parsedPayload.crawlDepth,
            recordedLive: parsedPayload.recordedLive,
            latitude: parsedPayload.latitude,
            longitude: parsedPayload.longitude
         };
      });
   }

   /**
    * Retries a failed task by setting its status back to pending.
    */
   async retryTask(taskId: string): Promise<boolean> {
      const connection = await this._connect();
      const task = await connection.get(`SELECT * FROM queue_messages WHERE id = ?`, [taskId]);
      if (!task || task.status !== 'failed') return false;

      await connection.run(
         `UPDATE queue_messages SET status = 'pending', progress = 0, error = NULL, started_at = NULL, completed_at = NULL WHERE id = ?`,
         [taskId]
      );
      return true;
   }

   /**
    * Deletes a task from the queue database if it's not currently processing.
    */
   async deleteTask(taskId: string): Promise<boolean> {
      const connection = await this._connect();
      const task = await connection.get(`SELECT * FROM queue_messages WHERE id = ?`, [taskId]);
      if (!task || task.status === 'processing') return false;

      await connection.run(`DELETE FROM queue_messages WHERE id = ?`, [taskId]);
      return true;
   }

   /**
    * Helper to update running task progress.
    */
   async updateProgress(taskId: string, progress: number): Promise<void> {
      const connection = await this._connect();
      await connection.run(`UPDATE queue_messages SET progress = ? WHERE id = ?`, [progress, taskId]);
   }
}
export default SQLiteQueueAdapter;
