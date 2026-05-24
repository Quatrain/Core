import { Worker } from './Worker'
import axios from 'axios'
import { spawn } from 'node:child_process'

// Mock dependencies
jest.mock('axios')
jest.mock('node:child_process')
jest.mock('@quatrain/queue', () => {
   const mockQueueInstance = {
      listen: jest.fn(),
   }
   return {
      Queue: {
         addQueue: jest.fn(),
         getQueue: jest.fn(() => mockQueueInstance),
         info: jest.fn(),
      },
   }
}, { virtual: true })

const mockedAxios = axios as jest.Mocked<typeof axios>
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>

describe('Worker', () => {
   beforeEach(() => {
      // Clear all mocks before each test
      jest.clearAllMocks()

      // Reset Worker.endpoint
      Worker.endpoint = ''
   })

   describe('endpoint property', () => {
      it('should have an empty endpoint by default', () => {
         expect(Worker.endpoint).toBe('')
      })

      it('should allow setting the endpoint', () => {
         Worker.endpoint = 'https://api.example.com/events'
         expect(Worker.endpoint).toBe('https://api.example.com/events')
      })
   })

   describe('pushEvent', () => {
      it('should return false when endpoint is not set', () => {
         const result = Worker.pushEvent('test-event')
         expect(result).toBe(false)
         expect(mockedAxios.patch).not.toHaveBeenCalled()
      })

      it('should send event when endpoint is set', () => {
         Worker.endpoint = 'https://api.example.com/events'

         mockedAxios.patch.mockResolvedValue({
            statusText: 'OK',
            data: { success: true },
         })

         Worker.pushEvent('test-event', { foo: 'bar' })

         expect(mockedAxios.patch).toHaveBeenCalledWith(
            'https://api.example.com/events',
            expect.objectContaining({
               event: 'test-event',
               foo: 'bar',
            })
         )
      })

      it('should include custom timestamp in payload', () => {
         Worker.endpoint = 'https://api.example.com/events'
         const customTs = 1234567890

         mockedAxios.patch.mockResolvedValue({
            statusText: 'OK',
            data: { success: true },
         })

         Worker.pushEvent('test-event', {}, customTs)

         expect(mockedAxios.patch).toHaveBeenCalledWith(
            'https://api.example.com/events',
            expect.objectContaining({
               event: 'test-event',
               ts: expect.any(Number),
            })
         )
      })

      it('should include additional data in payload', () => {
         Worker.endpoint = 'https://api.example.com/events'

         mockedAxios.patch.mockResolvedValue({
            statusText: 'OK',
            data: { success: true },
         })

         const additionalData = {
            userId: '123',
            action: 'upload',
            metadata: { size: 1024 },
         }

         Worker.pushEvent('custom-event', additionalData)

         expect(mockedAxios.patch).toHaveBeenCalledWith(
            'https://api.example.com/events',
            expect.objectContaining({
               event: 'custom-event',
               userId: '123',
               action: 'upload',
               metadata: { size: 1024 },
            })
         )
      })

      it('should execute then block on success in pushEvent', async () => {
         Worker.endpoint = 'https://api.example.com/events'

         mockedAxios.patch.mockResolvedValue({
            statusText: 'OK',
            data: { success: true },
         })

         Worker.pushEvent('test-event')

         // Allow microtasks to run so .then is executed
         await new Promise((resolve) => setTimeout(resolve, 0))

         expect(mockedAxios.patch).toHaveBeenCalled()
      })

      it('should handle axios error in pushEvent', async () => {
         Worker.endpoint = 'https://api.example.com/events'

         mockedAxios.patch.mockRejectedValue(new Error('Network error'))

         Worker.pushEvent('test-event')

         // Allow microtasks to run so .catch is executed
         await new Promise((resolve) => setTimeout(resolve, 0))

         expect(mockedAxios.patch).toHaveBeenCalled()
      })
   })

   describe('pushEventAsync', () => {
      it('should return false when endpoint is not set', async () => {
         const result = await Worker.pushEventAsync('test-event')
         expect(result).toBe(false)
         expect(mockedAxios.patch).not.toHaveBeenCalled()
      })

      it('should send event and return true on success', async () => {
         Worker.endpoint = 'https://api.example.com/events'

         mockedAxios.patch.mockResolvedValue({
            statusText: 'OK',
            data: { success: true },
         })

         const result = await Worker.pushEventAsync('test-event', {
            foo: 'bar',
         })

         expect(result).toBe(true)
         expect(mockedAxios.patch).toHaveBeenCalledWith(
            'https://api.example.com/events',
            expect.objectContaining({
               event: 'test-event',
               foo: 'bar',
            })
         )
      })

      it('should return false on axios error', async () => {
         Worker.endpoint = 'https://api.example.com/events'

         mockedAxios.patch.mockRejectedValue(new Error('Network error'))

         const result = await Worker.pushEventAsync('test-event')

         expect(result).toBe(false)
      })

      it('should handle non-OK status response', async () => {
         Worker.endpoint = 'https://api.example.com/events'

         mockedAxios.patch.mockResolvedValue({
            statusText: 'Bad Request',
            data: { error: 'Invalid payload' },
         })

         const result = await Worker.pushEventAsync('test-event')

         expect(result).toBe(undefined)
      })

      it('should include custom timestamp', async () => {
         Worker.endpoint = 'https://api.example.com/events'
         const customTs = 9876543210

         mockedAxios.patch.mockResolvedValue({
            statusText: 'OK',
            data: { success: true },
         })

         await Worker.pushEventAsync('test-event', {}, customTs)

         expect(mockedAxios.patch).toHaveBeenCalledWith(
            'https://api.example.com/events',
            expect.objectContaining({
               event: 'test-event',
               ts: expect.any(Number),
            })
         )
      })
   })

   describe('execPromise', () => {
      it('should execute command successfully', async () => {
         const mockChild = {
            stdout: {
               on: jest.fn((event, callback) => {
                  if (event === 'data') {
                     // Simulate stdout data
                     setTimeout(
                        () => callback(Buffer.from('Command output')),
                        10
                     )
                  }
               }),
            },
            stderr: {
               on: jest.fn(),
            },
            on: jest.fn((event, callback) => {
               if (event === 'close') {
                  // Simulate successful completion
                  setTimeout(() => callback(0), 20)
               }
            }),
         }

         mockedSpawn.mockReturnValue(mockChild as any)

         await expect(
            Worker.execPromise('ls', ['-la'], '/tmp')
         ).resolves.toBeUndefined()

         expect(mockedSpawn).toHaveBeenCalledWith('ls', ['-la'], {
            cwd: '/tmp',
            shell: false,
         })
      })

      it('should reject on command failure', async () => {
         const mockChild = {
            stdout: {
               on: jest.fn(),
            },
            stderr: {
               on: jest.fn((event, callback) => {
                  if (event === 'data') {
                     setTimeout(() => callback(Buffer.from('Error output')), 10)
                  }
               }),
            },
            on: jest.fn((event, callback) => {
               if (event === 'close') {
                  // Simulate failure with exit code 1
                  setTimeout(() => callback(1), 20)
               }
            }),
         }

         mockedSpawn.mockReturnValue(mockChild as any)

         await expect(
            Worker.execPromise('invalid-command', [])
         ).rejects.toThrow('Process failed and returned code: 1')
      })

      it('should use current working directory by default', async () => {
         const mockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
               if (event === 'close') {
                  setTimeout(() => callback(0), 10)
               }
            }),
         }

         mockedSpawn.mockReturnValue(mockChild as any)

         await Worker.execPromise('echo', ['test'])

         expect(mockedSpawn).toHaveBeenCalledWith('echo', ['test'], {
            cwd: process.cwd(),
            shell: false,
         })
      })

      it('should pass arguments to command', async () => {
         const mockChild = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
               if (event === 'close') {
                  setTimeout(() => callback(0), 10)
               }
            }),
         }

         mockedSpawn.mockReturnValue(mockChild as any)

         const args = ['arg1', 'arg2', '--flag']
         await Worker.execPromise('command', args, '/custom/path')

         expect(mockedSpawn).toHaveBeenCalledWith('command', args, {
            cwd: '/custom/path',
            shell: false,
         })
      })

      it('should throw an error when spawn itself throws', async () => {
         mockedSpawn.mockImplementationOnce(() => {
            throw new Error('Spawn failure')
         })

         await expect(Worker.execPromise('cmd')).rejects.toThrow('Spawn failure')
      })

      it('should throw and log when an error occurs before the promise constructor', async () => {
         const spyInfo = jest.spyOn(Worker, 'info').mockImplementationOnce(() => {
            throw new Error('Before promise error')
         })

         await expect(() => Worker.execPromise('cmd')).toThrow('Before promise error')
         spyInfo.mockRestore()
      })
   })

   describe('handler', () => {
      let originalExit: any

      beforeAll(() => {
         originalExit = process.exit
         process.exit = jest.fn() as any
      })

      afterAll(() => {
         process.exit = originalExit
      })

      beforeEach(() => {
         jest.clearAllMocks()
         delete process.env.JSON
      })

      it('should listen to queue in queue mode', async () => {
         const messageHandler = jest.fn()
         const config = {
            mode: 'queue' as const,
            topic: 'test-topic',
            queueAdapter: 'test-adapter' as any,
            concurrency: 5,
            gpu: false,
         }

         const { Queue } = require('@quatrain/queue')

         await Worker.handler(messageHandler, config)

         expect(Queue.addQueue).toHaveBeenCalledWith('test-adapter', 'default', true)
         expect(Queue.getQueue().listen).toHaveBeenCalledWith('test-topic', messageHandler, {
            concurrency: 5,
            gpu: false,
         })
      })

      it('should handle test mode and call messageHandler', async () => {
         const messageHandler = jest.fn()
         const config = {
            mode: 'test' as const,
         }

         await Worker.handler(messageHandler, config)

         expect(messageHandler).toHaveBeenCalledWith(
            expect.objectContaining({ dummy: 'test-data' })
         )
      })

      it('should handle cli mode with environment variable', async () => {
         const messageHandler = jest.fn()
         process.env.JSON = JSON.stringify({ cli: 'data' })
         const config = {
            mode: 'cli' as const,
         }

         await Worker.handler(messageHandler, config)

         expect(messageHandler).toHaveBeenCalledWith(JSON.stringify({ cli: 'data' }))
      })

      it('should throw when cli mode has no environment variable', async () => {
         const messageHandler = jest.fn()
         const config = {
            mode: 'cli' as const,
         }

         await Worker.handler(messageHandler, config)

         expect(process.exit).toHaveBeenCalledWith(1)
      })

      it('should exit when mode is unknown', async () => {
         const messageHandler = jest.fn()
         const config = {
            mode: 'unknown' as any,
         }

         await Worker.handler(messageHandler, config)

         expect(process.exit).toHaveBeenCalledWith(1)
      })
   })

   describe('logger', () => {
      it('should have a logger instance', () => {
         expect(Worker.logger).toBeDefined()
      })
   })
})
