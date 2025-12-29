import { Worker } from './Worker'
import axios from 'axios'
import { spawn } from 'child_process'

// Mock dependencies
jest.mock('axios')
jest.mock('child_process')

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
         })
      })
   })

   describe('logger', () => {
      it('should have a logger instance', () => {
         expect(Worker.logger).toBeDefined()
      })
   })
})
