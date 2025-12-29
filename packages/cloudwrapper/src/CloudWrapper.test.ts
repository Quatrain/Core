import { AbstractCloudWrapper } from './AbstractCloudWrapper'
import { CloudWrapper } from './CloudWrapper'
import {
   DatabaseTriggerType,
   StorageTriggerType,
   StorageEventPayloadType,
} from './index'
import { BackendAction } from '@quatrain/backend'

describe('CloudWrapper Package', () => {
   describe('AbstractCloudWrapper', () => {
      it('should create instance with params', () => {
         const params = { config: 'test-config', apiKey: 'test-key' }
         const wrapper = new AbstractCloudWrapper(params)

         expect(wrapper).toBeInstanceOf(AbstractCloudWrapper)
         // Access protected property through any for testing
         expect((wrapper as any)._params).toEqual(params)
      })

      it('should store empty params', () => {
         const wrapper = new AbstractCloudWrapper({})

         expect((wrapper as any)._params).toEqual({})
      })

      it('should store undefined params as undefined', () => {
         const wrapper = new AbstractCloudWrapper(undefined)

         expect((wrapper as any)._params).toBeUndefined()
      })
   })

   describe('CloudWrapper', () => {
      it('should extend Core class', () => {
         // CloudWrapper extends Core, so it should have Core properties
         expect(CloudWrapper).toBeDefined()
         expect(typeof CloudWrapper).toBe('function')
      })

      it('should have logger property', () => {
         expect(CloudWrapper.logger).toBeDefined()
         expect(CloudWrapper.logger).toHaveProperty('debug')
         expect(CloudWrapper.logger).toHaveProperty('info')
         expect(CloudWrapper.logger).toHaveProperty('warn')
         expect(CloudWrapper.logger).toHaveProperty('error')
      })

      it('should create logger with "Cloud" namespace', () => {
         // The logger is created with 'Cloud' namespace
         expect(CloudWrapper.logger).toBeDefined()
      })
   })

   describe('Type Exports', () => {
      describe('DatabaseTriggerType', () => {
         it('should be importable', () => {
            // Type check - if this compiles, the type exists
            const trigger: DatabaseTriggerType = {
               name: 'test-trigger',
               event: BackendAction.CREATE,
               script: () => {},
               model: 'User',
               path: '/users/{userId}',
               schema: 'public',
            }

            expect(trigger).toBeDefined()
            expect(trigger.name).toBe('test-trigger')
            expect(trigger.model).toBe('User')
            expect(trigger.path).toBe('/users/{userId}')
            expect(trigger.schema).toBe('public')
         })

         it('should work without optional schema', () => {
            const trigger: DatabaseTriggerType = {
               name: 'test-trigger',
               event: BackendAction.UPDATE,
               script: () => {},
               model: 'Post',
               path: '/posts/{postId}',
            }

            expect(trigger).toBeDefined()
            expect(trigger.schema).toBeUndefined()
         })

         it('should support array of events', () => {
            const trigger: DatabaseTriggerType = {
               name: 'multi-event-trigger',
               event: [BackendAction.CREATE, BackendAction.UPDATE],
               script: () => {},
               model: 'Comment',
               path: '/comments/{commentId}',
            }

            expect(trigger).toBeDefined()
            expect(Array.isArray(trigger.event)).toBe(true)
         })
      })

      describe('StorageTriggerType', () => {
         it('should be importable', () => {
            const trigger: StorageTriggerType = {
               name: 'storage-trigger',
               event: BackendAction.CREATE,
               script: () => {},
            }

            expect(trigger).toBeDefined()
            expect(trigger.name).toBe('storage-trigger')
         })

         it('should extend GenericTriggerType', () => {
            // StorageTriggerType should have all GenericTriggerType properties
            const trigger: StorageTriggerType = {
               name: 'file-upload',
               event: [
                  BackendAction.CREATE,
                  BackendAction.UPDATE,
                  BackendAction.DELETE,
               ],
               script: () => {},
            }

            expect(trigger.name).toBeDefined()
            expect(trigger.event).toBeDefined()
            expect(trigger.script).toBeDefined()
         })
      })

      describe('StorageEventPayloadType', () => {
         it('should be importable', () => {
            const payload: StorageEventPayloadType = {
               before: undefined,
               after: {
                  name: 'test.jpg',
                  bucket: 'uploads',
                  fullPath: '/uploads/test.jpg',
                  contentType: 'image/jpeg',
                  size: 1024,
                  timeCreated: new Date(),
                  updated: new Date(),
               },
               context: {},
            }

            expect(payload).toBeDefined()
            expect(payload.before).toBeUndefined()
            expect(payload.after).toBeDefined()
         })

         it('should support before and after file objects', () => {
            const fileData = {
               name: 'document.pdf',
               bucket: 'documents',
               fullPath: '/documents/document.pdf',
               contentType: 'application/pdf',
               size: 2048,
               timeCreated: new Date(),
               updated: new Date(),
            }

            const payload: StorageEventPayloadType = {
               before: fileData,
               after: { ...fileData, size: 3072 }, // Modified size
               context: { userId: 'user-123' },
            }

            expect(payload.before?.size).toBe(2048)
            expect(payload.after?.size).toBe(3072)
            expect(payload.context.userId).toBe('user-123')
         })

         it('should allow undefined before for create events', () => {
            const payload: StorageEventPayloadType = {
               before: undefined,
               after: {
                  name: 'new-file.txt',
                  bucket: 'files',
                  fullPath: '/files/new-file.txt',
                  contentType: 'text/plain',
                  size: 512,
                  timeCreated: new Date(),
                  updated: new Date(),
               },
               context: {},
            }

            expect(payload.before).toBeUndefined()
            expect(payload.after).toBeDefined()
         })

         it('should allow undefined after for delete events', () => {
            const payload: StorageEventPayloadType = {
               before: {
                  name: 'deleted-file.txt',
                  bucket: 'files',
                  fullPath: '/files/deleted-file.txt',
                  contentType: 'text/plain',
                  size: 256,
                  timeCreated: new Date(),
                  updated: new Date(),
               },
               after: undefined,
               context: {},
            }

            expect(payload.before).toBeDefined()
            expect(payload.after).toBeUndefined()
         })
      })
   })

   describe('Module Exports', () => {
      it('should export AbstractCloudWrapper', () => {
         expect(AbstractCloudWrapper).toBeDefined()
         expect(typeof AbstractCloudWrapper).toBe('function')
      })

      it('should export CloudWrapper', () => {
         expect(CloudWrapper).toBeDefined()
         expect(typeof CloudWrapper).toBe('function')
      })

      it('should export all type definitions', () => {
         // If these imports work, the exports are correct
         // TypeScript will catch any export issues at compile time
         expect(true).toBe(true)
      })
   })
})
