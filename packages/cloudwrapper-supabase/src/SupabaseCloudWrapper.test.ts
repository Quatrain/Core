import { SupabaseCloudWrapper, eventMap } from './SupabaseCloudWrapper'
import { BackendAction } from '@quatrain/backend'
import { DatabaseTriggerType, StorageTriggerType } from '@quatrain/cloudwrapper'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('@supabase/supabase-js')
jest.mock('ws')

describe('SupabaseCloudWrapper', () => {
   let wrapper: SupabaseCloudWrapper
   let mockChannel: any
   let mockSubscribe: jest.Mock
   let mockOn: jest.Mock
   let mockSupabaseClient: any
   let processExitSpy: jest.SpyInstance
   let heartbeatCallback: any

   beforeEach(() => {
      jest.clearAllMocks()
      jest.clearAllTimers()
      jest.useFakeTimers()

      // Spy on process.exit to prevent actual exits
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
         throw new Error('process.exit called')
      })

      // Create mock subscription chain
      mockSubscribe = jest.fn().mockReturnValue(undefined)
      mockOn = jest.fn().mockReturnValue({ subscribe: mockSubscribe })
      mockChannel = jest.fn().mockReturnValue({ on: mockOn })

      // Create mock Supabase client
      mockSupabaseClient = {
         channel: mockChannel,
      }

      // Mock createClient to capture heartbeat callback
      ;(createClient as jest.Mock).mockImplementation((url, key, options) => {
         heartbeatCallback = options?.realtime?.heartbeatCallback
         const client = new SupabaseClient(url, key, options)
         Object.assign(client, { channel: mockChannel })
         return client
      })
   })

   afterEach(() => {
      jest.useRealTimers()
      processExitSpy.mockRestore()
   })

   describe('eventMap', () => {
      it('should map BackendAction to Supabase events', () => {
         expect(eventMap[BackendAction.CREATE]).toBe('INSERT')
         expect(eventMap[BackendAction.UPDATE]).toBe('UPDATE')
         expect(eventMap[BackendAction.DELETE]).toBe('DELETE')
      })
   })

   describe('Constructor and Initialization', () => {
      it('should create Supabase client with correct params', () => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key-123',
         })

         expect(createClient).toHaveBeenCalledWith(
            'https://test.supabase.co',
            'test-key-123',
            expect.objectContaining({
               realtime: expect.objectContaining({
                  transport: expect.anything(),
                  heartbeatIntervalMs: 5000,
                  heartbeatCallback: expect.any(Function),
               }),
            })
         )
      })

      it('should set initialization flag', () => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
         })

         expect((wrapper as any)._isInitialized).toBe(true)
      })

      it('should initialize heartbeat monitoring', () => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
         })

         expect(heartbeatCallback).toBeDefined()
         expect(typeof heartbeatCallback).toBe('function')
      })

      it('should set connection timeout', () => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
         })

         expect((wrapper as any)._connectionTimeout).toBeDefined()
      })
   })

   describe('Heartbeat Monitoring', () => {
      beforeEach(() => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
         })
      })

      it('should handle "ok" heartbeat status', () => {
         expect((wrapper as any)._heartbeatOkReceived).toBe(false)

         heartbeatCallback('ok')

         expect((wrapper as any)._heartbeatOkReceived).toBe(true)
      })

      it('should clear timeout on successful heartbeat', () => {
         const initialTimeout = (wrapper as any)._connectionTimeout

         heartbeatCallback('ok')

         expect((wrapper as any)._connectionTimeout).toBe(initialTimeout)
      })

      it('should handle "timeout" status', () => {
         // Should not throw or exit
         expect(() => heartbeatCallback('timeout')).not.toThrow()
      })

      it('should reconnect on "disconnected" when exitOnDisconnect is false', () => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
            exitOnDisconnect: false,
         })

         const createClientCallsBefore = (createClient as jest.Mock).mock.calls
            .length

         heartbeatCallback = (createClient as jest.Mock).mock.calls[
            createClientCallsBefore - 1
         ][2].realtime.heartbeatCallback

         heartbeatCallback('disconnected')

         // Should attempt reconnection (call createClient again)
         expect((createClient as jest.Mock).mock.calls.length).toBeGreaterThan(
            createClientCallsBefore
         )
      })

      it('should exit on "disconnected" by default', () => {
         expect(() => heartbeatCallback('disconnected')).toThrow(
            'process.exit called'
         )
         expect(processExitSpy).toHaveBeenCalledWith(1)
      })

      it('should exit on "disconnected" when exitOnDisconnect is true', () => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
            exitOnDisconnect: true,
         })

         heartbeatCallback = (createClient as jest.Mock).mock.calls[1][2]
            .realtime.heartbeatCallback

         expect(() => heartbeatCallback('disconnected')).toThrow(
            'process.exit called'
         )
         expect(processExitSpy).toHaveBeenCalledWith(1)
      })
   })

   describe('Connection Timeout', () => {
      it('should exit if heartbeat not received within 30 seconds', () => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
         })

         expect(() => jest.advanceTimersByTime(30000)).toThrow(
            'process.exit called'
         )
         expect(processExitSpy).toHaveBeenCalledWith(1)
      })

      it('should not exit if heartbeat received before timeout', () => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
         })

         heartbeatCallback('ok')

         expect(() => jest.advanceTimersByTime(30000)).not.toThrow()
         expect(processExitSpy).not.toHaveBeenCalled()
      })
   })

   describe('databaseTrigger()', () => {
      beforeEach(() => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
         })
         heartbeatCallback('ok') // Simulate successful connection
      })

      it('should set up single event trigger', () => {
         const trigger: DatabaseTriggerType = {
            name: 'test-trigger',
            event: BackendAction.CREATE,
            script: jest.fn(),
            model: 'users',
            path: '/users/{id}',
            schema: 'public',
         }

         wrapper.databaseTrigger(trigger)

         expect(mockChannel).toHaveBeenCalledWith('test-trigger')
         expect(mockOn).toHaveBeenCalledWith(
            'postgres_changes',
            {
               event: 'INSERT',
               schema: 'public',
               table: 'users',
            },
            expect.any(Function)
         )
         expect(mockSubscribe).toHaveBeenCalled()
      })

      it('should use default schema if not provided', () => {
         const trigger: DatabaseTriggerType = {
            name: 'test-trigger',
            event: BackendAction.UPDATE,
            script: jest.fn(),
            model: 'posts',
            path: '/posts/{id}',
         }

         wrapper.databaseTrigger(trigger)

         expect(mockOn).toHaveBeenCalledWith(
            'postgres_changes',
            expect.objectContaining({
               schema: 'public',
            }),
            expect.any(Function)
         )
      })

      it('should handle multiple events', () => {
         const trigger: DatabaseTriggerType = {
            name: 'multi-trigger',
            event: [BackendAction.CREATE, BackendAction.UPDATE],
            script: jest.fn(),
            model: 'comments',
            path: '/comments/{id}',
         }

         wrapper.databaseTrigger(trigger)

         expect(mockChannel).toHaveBeenCalledWith('multi-trigger-create')
         expect(mockChannel).toHaveBeenCalledWith('multi-trigger-update')
         expect(mockSubscribe).toHaveBeenCalledTimes(2)
      })

      it('should throw TypeError if script is not a function', () => {
         const trigger: any = {
            name: 'bad-trigger',
            event: BackendAction.CREATE,
            script: 'not-a-function',
            model: 'users',
            path: '/users/{id}',
         }

         expect(() => wrapper.databaseTrigger(trigger)).toThrow(TypeError)
         expect(() => wrapper.databaseTrigger(trigger)).toThrow(
            'Passed script value is not a function'
         )
      })

      it('should execute script with payload when event fires', async () => {
         const scriptMock = jest.fn().mockResolvedValue(undefined)
         const trigger: DatabaseTriggerType = {
            name: 'test-trigger',
            event: BackendAction.CREATE,
            script: scriptMock,
            model: 'users',
            path: '/users/{id}',
         }

         wrapper.databaseTrigger(trigger)

         // Get the callback passed to .on()
         const callback = mockOn.mock.calls[0][2]

         const payload = {
            old: { id: 1, name: 'old' },
            new: { id: 1, name: 'new' },
            extra: 'context',
         }

         await callback(payload)

         expect(scriptMock).toHaveBeenCalledWith({
            before: payload.old,
            after: payload.new,
            context: { extra: 'context' },
         })
      })
   })

   describe('storageTrigger()', () => {
      beforeEach(() => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
         })
         heartbeatCallback('ok')
      })

      it('should set up single event storage trigger', () => {
         const trigger: StorageTriggerType = {
            name: 'storage-trigger',
            event: BackendAction.CREATE,
            script: jest.fn(),
         }

         wrapper.storageTrigger(trigger)

         expect(mockChannel).toHaveBeenCalledWith('storage-trigger')
         expect(mockOn).toHaveBeenCalledWith(
            'postgres_changes',
            {
               event: 'INSERT',
               schema: 'storage',
               table: 'objects',
            },
            expect.any(Function)
         )
         expect(mockSubscribe).toHaveBeenCalled()
      })

      it('should handle multiple events', () => {
         const trigger: StorageTriggerType = {
            name: 'multi-storage',
            event: [BackendAction.CREATE, BackendAction.DELETE],
            script: jest.fn(),
         }

         wrapper.storageTrigger(trigger)

         expect(mockChannel).toHaveBeenCalledWith('multi-storage-create')
         expect(mockChannel).toHaveBeenCalledWith('multi-storage-delete')
         expect(mockSubscribe).toHaveBeenCalledTimes(2)
      })

      it('should throw TypeError if script is not a function', () => {
         const trigger: any = {
            name: 'bad-storage',
            event: BackendAction.CREATE,
            script: 123,
         }

         expect(() => wrapper.storageTrigger(trigger)).toThrow(TypeError)
      })

      it('should transform payload and execute script', async () => {
         const scriptMock = jest.fn().mockResolvedValue(undefined)
         const trigger: StorageTriggerType = {
            name: 'storage-trigger',
            event: BackendAction.CREATE,
            script: scriptMock,
         }

         wrapper.storageTrigger(trigger)

         const callback = mockOn.mock.calls[0][2]

         const payload = {
            old: {},
            new: {
               bucket_id: 'uploads',
               name: 'test.jpg',
               metadata: { size: 1024, mimetype: 'image/jpeg' },
            },
            context: 'test-context',
         }

         await callback(payload)

         expect(scriptMock).toHaveBeenCalledWith({
            before: undefined,
            after: {
               host: 'supabase',
               bucket: 'uploads',
               ref: 'test.jpg',
               contentType: 'image/jpeg',
               size: 1024,
            },
            context: { context: 'test-context' },
         })
      })
   })

   describe('_payload2File()', () => {
      beforeEach(() => {
         wrapper = new SupabaseCloudWrapper({
            url: 'https://test.supabase.co',
            key: 'test-key',
         })
      })

      it('should convert valid payload to FileType', () => {
         const payload = {
            bucket_id: 'avatars',
            name: 'profile.png',
            metadata: {
               size: 2048,
               mimetype: 'image/png',
            },
         }

         const result = (wrapper as any)._payload2File(payload)

         expect(result).toEqual({
            host: 'supabase',
            bucket: 'avatars',
            ref: 'profile.png',
            contentType: 'image/png',
            size: 2048,
         })
      })

      it('should return undefined for payload without metadata', () => {
         const payload = {
            bucket_id: 'uploads',
            name: 'file.txt',
         }

         const result = (wrapper as any)._payload2File(payload)

         expect(result).toBeUndefined()
      })

      it('should return undefined for empty payload', () => {
         const payload = {}

         const result = (wrapper as any)._payload2File(payload)

         expect(result).toBeUndefined()
      })

      it('should handle missing size or mimetype', () => {
         const payload = {
            bucket_id: 'docs',
            name: 'document.pdf',
            metadata: {},
         }

         const result = (wrapper as any)._payload2File(payload)

         expect(result).toEqual({
            host: 'supabase',
            bucket: 'docs',
            ref: 'document.pdf',
            contentType: undefined,
            size: undefined,
         })
      })
   })

   describe('Module Exports', () => {
      it('should export SupabaseCloudWrapper', () => {
         expect(SupabaseCloudWrapper).toBeDefined()
         expect(typeof SupabaseCloudWrapper).toBe('function')
      })

      it('should export eventMap', () => {
         expect(eventMap).toBeDefined()
         expect(typeof eventMap).toBe('object')
      })
   })
})
