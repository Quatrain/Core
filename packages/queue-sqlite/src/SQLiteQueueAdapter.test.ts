import { SQLiteQueueAdapter } from './SQLiteQueueAdapter';

describe('SQLiteQueueAdapter', () => {
   let adapter: SQLiteQueueAdapter;

   beforeEach(() => {
      // Use in-memory database for testing to ensure isolated and fast tests
      adapter = new SQLiteQueueAdapter({
         config: { database: ':memory:' }
      });
   });

   afterEach(async () => {
      const adapterAny = adapter as any;
      if (adapterAny._intervals) {
         for (const interval of adapterAny._intervals.values()) {
            clearInterval(interval);
         }
      }
      if (adapterAny._connection) {
         await adapterAny._connection.close();
      }
   });

   it('should initialize and create queue_messages table', async () => {
      const conn = await (adapter as any)._connect();
      const tableCheck = await conn.get(
         `SELECT name FROM sqlite_master WHERE type='table' AND name='queue_messages'`
      );
      expect(tableCheck).toBeDefined();
      expect(tableCheck.name).toBe('queue_messages');
   });

   it('should send a task to the queue', async () => {
      const data = { type: 'text', name: 'test-task', textContent: 'hello' };
      const id = await adapter.send(data, 'test-topic');
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');

      const tasks = await adapter.getTasks('test-topic');
      expect(tasks.length).toBe(1);
      expect(tasks[0].id).toBe(id);
      expect(tasks[0].status).toBe('pending');
      expect(tasks[0].type).toBe('text');
      expect(tasks[0].name).toBe('test-task');
   });

   it('should process a task via listen and mark it completed', async () => {
      const data = { type: 'image', name: 'img-task' };
      await adapter.send(data, 'test-listen');

      let processed = false;

      const listener = adapter.listen('test-listen', async (payload: any, options: any) => {
         expect(payload.name).toBe('img-task');
         await options.updateProgress(50);
         processed = true;
      });

      // Wait for adapter interval to pick up and process task (interval runs every 1000ms)
      await new Promise(resolve => setTimeout(resolve, 1200));

      listener.stop();

      expect(processed).toBe(true);

      const tasks = await adapter.getTasks('test-listen');
      expect(tasks[0].status).toBe('completed');
      expect(tasks[0].progress).toBe(100);
   });

   it('should process a task and mark it failed if handler throws', async () => {
      const data = { type: 'audio', name: 'fail-task' };
      await adapter.send(data, 'test-fail');

      const listener = adapter.listen('test-fail', async () => {
         throw new Error('Test task execution failure');
      });

      await new Promise(resolve => setTimeout(resolve, 1200));
      listener.stop();

      const tasks = await adapter.getTasks('test-fail');
      expect(tasks[0].status).toBe('failed');
      expect(tasks[0].error).toBe('Test task execution failure');
   });

   it('should retry a failed task', async () => {
      const data = { type: 'text', name: 'retry-task' };
      const id = await adapter.send(data, 'test-retry');

      const listener = adapter.listen('test-retry', async () => {
         throw new Error('fail');
      });

      await new Promise(resolve => setTimeout(resolve, 1200));
      listener.stop();

      let tasks = await adapter.getTasks('test-retry');
      expect(tasks[0].status).toBe('failed');

      const retried = await adapter.retryTask(id);
      expect(retried).toBe(true);

      tasks = await adapter.getTasks('test-retry');
      expect(tasks[0].status).toBe('pending');
      expect(tasks[0].error).toBeNull();
   });

   it('should delete a task from the queue', async () => {
      const data = { type: 'text', name: 'delete-task' };
      const id = await adapter.send(data, 'test-delete');

      let tasks = await adapter.getTasks('test-delete');
      expect(tasks.length).toBe(1);

      const deleted = await adapter.deleteTask(id);
      expect(deleted).toBe(true);

      tasks = await adapter.getTasks('test-delete');
      expect(tasks.length).toBe(0);
   });
});
