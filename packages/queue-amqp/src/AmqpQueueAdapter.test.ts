import { AmqpQueueAdapter } from './AmqpQueueAdapter'
import amqplib from 'amqplib'
import { Queue } from '@quatrain/queue'

// Mock the amqplib library
jest.mock('amqplib')

const mockSendToQueue = jest.fn()
const mockAck = jest.fn()
const mockNack = jest.fn()
const mockAssertQueue = jest.fn().mockResolvedValue({})
const mockPrefetch = jest.fn().mockResolvedValue({})
const mockConsume = jest.fn().mockResolvedValue({})
const mockCloseChannel = jest.fn().mockResolvedValue({})

const mockCreateChannel = jest.fn().mockResolvedValue({
   sendToQueue: mockSendToQueue,
   assertQueue: mockAssertQueue,
   prefetch: mockPrefetch,
   consume: mockConsume,
   ack: mockAck,
   nack: mockNack,
   close: mockCloseChannel,
})

const mockCloseConnection = jest.fn().mockResolvedValue({})

const mockConnect = jest.fn().mockResolvedValue({
   createChannel: mockCreateChannel,
   close: mockCloseConnection,
})

;(amqplib.connect as jest.Mock).mockImplementation(mockConnect)

describe('AmqpQueueAdapter', () => {
   const params = {
      config: {
         host: 'test-host',
         user: 'test-user',
         password: 'test-password', // NOSONAR
         port: 1234,
      },
      topic: 'default-topic',
   }

   let mockProcessExit: jest.SpyInstance
   let mockLogger: any

   beforeAll(() => {
      mockLogger = {
         info: jest.fn(),
         debug: jest.fn(),
         warn: jest.fn(),
         error: jest.fn(),
      }
      jest.spyOn(Queue.logger, 'clone').mockReturnValue(mockLogger)
   })

   beforeEach(() => {
      mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      mockConnect.mockClear()
      mockCreateChannel.mockClear()
      mockCloseConnection.mockClear()
      mockSendToQueue.mockClear()
      mockAssertQueue.mockClear()
      mockPrefetch.mockClear()
      mockConsume.mockClear()
      mockAck.mockClear()
      mockNack.mockClear()
      mockCloseChannel.mockClear()
      mockLogger.info.mockClear()
      mockLogger.debug.mockClear()
      mockLogger.warn.mockClear()
      mockLogger.error.mockClear()
   })

   afterEach(() => {
      mockProcessExit.mockRestore()
   })

   describe('connection parameters', () => {
      it('should connect with default parameters', async () => {
         const adapter = new AmqpQueueAdapter({ config: {} })
         await (adapter as any)._connect()
         expect(mockConnect).toHaveBeenCalledWith('amqp://guest:guest@localhost:5672')
      })

      it('should connect with custom parameters', async () => {
         const adapter = new AmqpQueueAdapter(params)
         await (adapter as any)._connect()
         expect(mockConnect).toHaveBeenCalledWith('amqp://test-user:test-password@test-host:1234')
      })
   })

   describe('send', () => {
      it('should send a message to the specified topic', async () => {
         const adapter = new AmqpQueueAdapter(params)
         const data = { key: 'value' }
         const topic = 'test-topic'

         const confirmId = await adapter.send(data, topic)

         expect(mockConnect).toHaveBeenCalledTimes(1)
         expect(mockCreateChannel).toHaveBeenCalledTimes(1)
         expect(mockSendToQueue).toHaveBeenCalledWith(
            topic,
            Buffer.from(JSON.stringify(data))
         )
         expect(mockCloseChannel).toHaveBeenCalledTimes(1)
         expect(mockLogger.info).toHaveBeenCalledWith(
            `Sending message to ${topic}`
         )
         expect(confirmId).toBeDefined()
      })
   })

   describe('listen', () => {
      it('should listen to the default topic if none is provided', async () => {
         const adapter = new AmqpQueueAdapter(params)
         const handler = jest.fn()

         await adapter.listen(undefined, handler)

         expect(mockConnect).toHaveBeenCalledTimes(1)
         expect(mockCreateChannel).toHaveBeenCalledTimes(1)
         expect(mockAssertQueue).toHaveBeenCalledWith(params.topic, { durable: true, autoDelete: false })
         expect(mockPrefetch).toHaveBeenCalledWith(0)
         expect(mockConsume).toHaveBeenCalledWith(
            params.topic,
            expect.any(Function),
            { noAck: false }
         )
      })

      it('should listen to a specific topic', async () => {
         const adapter = new AmqpQueueAdapter(params)
         const handler = jest.fn()
         const topic = 'specific-topic'

         await adapter.listen(topic, handler)

         expect(mockAssertQueue).toHaveBeenCalledWith(topic, { durable: true, autoDelete: false })
      })

      it('should throw an error if no topic is available', async () => {
         const adapter = new AmqpQueueAdapter({ config: {} })
         const handler = jest.fn()

         await expect(adapter.listen(undefined, handler)).rejects.toThrow(
            'No topic provided for listening.'
         )
      })

      it('should call the message handler with the message body', async () => {
         const adapter = new AmqpQueueAdapter(params)
         const handler = jest.fn()
         const messageContent = { data: 'test message' }
         const message = {
            content: Buffer.from(JSON.stringify(messageContent)),
         } as any

         mockConsume.mockImplementation(async (topic, callback, options) => {
            await callback(message)
         })

         await adapter.listen('any-topic', handler)

         expect(handler).toHaveBeenCalledWith(
            JSON.stringify(messageContent),
            undefined
         )
         expect(mockAck).toHaveBeenCalledWith(message)
      })
   })
})
