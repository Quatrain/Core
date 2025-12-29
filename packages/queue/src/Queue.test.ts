import { Queue, QueueParametersKeys } from './Queue'
import { MockQueueAdapter } from './MockQueueAdapter'

describe('Queue', () => {
   let mockAdapter1: MockQueueAdapter
   let mockAdapter2: MockQueueAdapter

   beforeEach(() => {
      // Reset queues before each test
      ;(Queue as any)._queues = {}
      Queue.defaultQueue = '@default'

      // Create fresh mock adapters
      mockAdapter1 = new MockQueueAdapter({ config: {} })
      mockAdapter2 = new MockQueueAdapter({ config: {} })
   })

   afterEach(() => {
      // Clean up
      mockAdapter1?.clearAll()
      mockAdapter2?.clearAll()
   })

   describe('addQueue', () => {
      it('should add a queue with an alias', () => {
         Queue.addQueue(mockAdapter1, 'test-queue')

         const queue = Queue.getQueue('test-queue')
         expect(queue).toBe(mockAdapter1)
      })

      it('should add multiple queues with different aliases', () => {
         Queue.addQueue(mockAdapter1, 'queue1')
         Queue.addQueue(mockAdapter2, 'queue2')

         const queue1 = Queue.getQueue('queue1')
         const queue2 = Queue.getQueue('queue2')

         expect(queue1).toBe(mockAdapter1)
         expect(queue2).toBe(mockAdapter2)
      })

      it('should set default queue when setDefault is true', () => {
         Queue.addQueue(mockAdapter1, 'custom-queue', true)

         expect(Queue.defaultQueue).toBe('custom-queue')
         const queue = Queue.getQueue() // Should use default
         expect(queue).toBe(mockAdapter1)
      })

      it('should not change default queue when setDefault is false', () => {
         const originalDefault = Queue.defaultQueue
         Queue.addQueue(mockAdapter1, 'custom-queue', false)

         expect(Queue.defaultQueue).toBe(originalDefault)
      })

      it('should allow overriding an existing queue', () => {
         Queue.addQueue(mockAdapter1, 'queue')
         Queue.addQueue(mockAdapter2, 'queue')

         const queue = Queue.getQueue('queue')
         expect(queue).toBe(mockAdapter2)
      })
   })

   describe('getQueue', () => {
      it('should return the correct queue by alias', () => {
         Queue.addQueue(mockAdapter1, 'test-queue')

         const queue = Queue.getQueue('test-queue')
         expect(queue).toBe(mockAdapter1)
      })

      it('should return the default queue when no alias is specified', () => {
         Queue.addQueue(mockAdapter1, '@default', true)

         const queue = Queue.getQueue()
         expect(queue).toBe(mockAdapter1)
      })

      it('should throw error when queue alias does not exist', () => {
         expect(() => {
            Queue.getQueue('non-existent')
         }).toThrow("Unknown queue alias: 'non-existent'")
      })

      it('should throw error when getting default queue that does not exist', () => {
         expect(() => {
            Queue.getQueue()
         }).toThrow("Unknown queue alias: '@default'")
      })

      it('should be type-safe with generic parameter', () => {
         Queue.addQueue(mockAdapter1, 'typed-queue')

         const queue = Queue.getQueue<MockQueueAdapter>('typed-queue')
         expect(queue).toBeInstanceOf(MockQueueAdapter)
      })
   })

   describe('defaultQueue property', () => {
      it('should have a default value of "@default"', () => {
         expect(Queue.defaultQueue).toBe('@default')
      })

      it('should allow changing the default queue', () => {
         Queue.addQueue(mockAdapter1, 'new-default', true)
         expect(Queue.defaultQueue).toBe('new-default')
      })
   })

   describe('Integration with MockQueueAdapter', () => {
      it('should work with adapter send method', async () => {
         Queue.addQueue(mockAdapter1, 'test')
         const queue = Queue.getQueue<MockQueueAdapter>('test')

         const messageId = await queue.send(
            { data: 'test message' },
            'test-topic'
         )

         expect(messageId).toBeDefined()
         expect(messageId).toMatch(/^msg-/)
         expect(queue.getMessageCount('test-topic')).toBe(1)
      })

      it('should work with adapter listen method', () => {
         Queue.addQueue(mockAdapter1, 'test')
         const queue = Queue.getQueue<MockQueueAdapter>('test')

         const handler = jest.fn()
         const listener = queue.listen('test-topic', handler, {
            concurrency: 5,
            gpu: true,
         })

         expect(listener).toEqual({
            topic: 'test-topic',
            handler,
            concurrency: 5,
            gpu: true,
         })
         expect(queue.hasHandler('test-topic')).toBe(true)
      })

      it('should maintain separate state between queues', async () => {
         Queue.addQueue(mockAdapter1, 'queue1')
         Queue.addQueue(mockAdapter2, 'queue2')

         const adapter1 = Queue.getQueue<MockQueueAdapter>('queue1')
         const adapter2 = Queue.getQueue<MockQueueAdapter>('queue2')

         await adapter1.send({ message: 'queue1 message' }, 'topic1')
         await adapter2.send({ message: 'queue2 message' }, 'topic2')

         expect(adapter1.getMessageCount('topic1')).toBe(1)
         expect(adapter1.getMessageCount('topic2')).toBe(0)

         expect(adapter2.getMessageCount('topic2')).toBe(1)
         expect(adapter2.getMessageCount('topic1')).toBe(0)
      })

      it('should invoke handler when message is sent', async () => {
         Queue.addQueue(mockAdapter1, 'test')
         const queue = Queue.getQueue<MockQueueAdapter>('test')

         const handler = jest.fn()
         queue.listen('test-topic', handler)

         await queue.send({ data: 'test' }, 'test-topic')

         // Wait for async handler invocation
         await new Promise((resolve) => setTimeout(resolve, 10))

         expect(handler).toHaveBeenCalledWith({ data: 'test' })
      })
   })

   describe('Queue registry behavior', () => {
      it('should maintain queues across multiple operations', () => {
         Queue.addQueue(mockAdapter1, 'persistent')

         // Multiple get operations
         const queue1 = Queue.getQueue('persistent')
         const queue2 = Queue.getQueue('persistent')

         expect(queue1).toBe(queue2)
         expect(queue1).toBe(mockAdapter1)
      })

      it('should handle switching default queue multiple times', () => {
         Queue.addQueue(mockAdapter1, 'queue1', true)
         expect(Queue.defaultQueue).toBe('queue1')

         Queue.addQueue(mockAdapter2, 'queue2', true)
         expect(Queue.defaultQueue).toBe('queue2')

         const defaultQueue = Queue.getQueue()
         expect(defaultQueue).toBe(mockAdapter2)
      })
   })

   describe('logger', () => {
      it('should have a logger instance', () => {
         expect(Queue.logger).toBeDefined()
      })
   })
})
