import fs from 'node:fs'
import path from 'node:path'
import { AppBootloader } from './Bootloader'
import { Backend } from '@quatrain/backend'
import { Auth } from '@quatrain/auth'
import { Queue } from '@quatrain/queue'
import { Storage } from '@quatrain/storage'
import { Messaging } from '@quatrain/messaging'
import { Log } from '@quatrain/log'

// Mock dynamic require targets as virtual modules
jest.mock('mock-backend', () => ({
   MockBackend: jest.fn().mockImplementation(() => ({ name: 'mock-backend' }))
}), { virtual: true })

jest.mock('mock-auth', () => ({
   MockAuth: jest.fn().mockImplementation(() => ({ name: 'mock-auth' }))
}), { virtual: true })

jest.mock('mock-queue', () => ({
   MockQueue: jest.fn().mockImplementation(() => ({ name: 'mock-queue' }))
}), { virtual: true })

jest.mock('mock-storage', () => ({
   MockStorage: jest.fn().mockImplementation(() => ({ name: 'mock-storage' }))
}), { virtual: true })

jest.mock('mock-messaging', () => ({
   MockMessaging: jest.fn().mockImplementation(() => ({ name: 'mock-messaging' }))
}), { virtual: true })

describe('AppBootloader', () => {
   describe('resolveEnv', () => {
      beforeEach(() => {
         process.env.TEST_VAR = 'value1'
         process.env.ANOTHER_VAR = 'value2'
      })

      afterEach(() => {
         delete process.env.TEST_VAR
         delete process.env.ANOTHER_VAR
      })

      it('should parse env(VAR) strings to environment variables values', () => {
         const resolved = (AppBootloader as any).resolveEnv('env(TEST_VAR)')
         expect(resolved).toBe('value1')
      })

      it('should parse raw strings as is', () => {
         const resolved = (AppBootloader as any).resolveEnv('just-a-string')
         expect(resolved).toBe('just-a-string')
      })

      it('should resolve env markers nested inside arrays', () => {
         const input = ['just-a-string', 'env(TEST_VAR)', 'env(ANOTHER_VAR)']
         const resolved = (AppBootloader as any).resolveEnv(input)
         expect(resolved).toEqual(['just-a-string', 'value1', 'value2'])
      })

      it('should resolve env markers nested inside objects', () => {
         const input = {
            plain: 'string',
            secret: 'env(TEST_VAR)',
            nested: {
               key: 'env(ANOTHER_VAR)'
            }
         }
         const resolved = (AppBootloader as any).resolveEnv(input)
         expect(resolved).toEqual({
            plain: 'string',
            secret: 'value1',
            nested: {
               key: 'value2'
            }
         })
      })

      it('should return default empty strings for undefined environment variables', () => {
         const resolved = (AppBootloader as any).resolveEnv('env(UNDEFINED_VAR)')
         expect(resolved).toBe('')
      })
   })

   describe('bootstrap', () => {
      let existsSpy: jest.SpyInstance
      let readSpy: jest.SpyInstance

      beforeEach(() => {
         existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
         readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('{}')

         // Spy on manager classes to prevent real registrations polluting other test runs
         jest.spyOn(Backend, 'addBackend').mockImplementation(() => {})
         jest.spyOn(Auth, 'addProvider').mockImplementation(() => {})
         jest.spyOn(Queue, 'addQueue').mockImplementation(() => {})
         jest.spyOn(Storage, 'addStorage').mockImplementation(() => {})
         jest.spyOn(Messaging, 'addMessager').mockImplementation(() => {})
         jest.spyOn(Log, 'info').mockImplementation(() => {})
         jest.spyOn(Log, 'error').mockImplementation(() => {})
      })

      afterEach(() => {
         jest.restoreAllMocks()
      })

      it('should throw an error if configuration file is not found', async () => {
         existsSpy.mockReturnValue(false)
         await expect(AppBootloader.bootstrap('missing.json')).rejects.toThrow(
            '[Bootloader] Configuration file not found'
         )
      })

      it('should bootstrap active configured adapters from configuration JSON', async () => {
         const config = {
            logLevel: 'debug',
            backend: {
               package: 'mock-backend',
               adapter: 'MockBackend',
               config: { db: 'test' }
            },
            auth: {
               package: 'mock-auth',
               adapter: 'MockAuth',
               config: {}
            },
            queue: {
               package: 'mock-queue',
               adapter: 'MockQueue',
               config: {}
            },
            storage: {
               package: 'mock-storage',
               adapter: 'MockStorage',
               config: {}
            },
            messaging: {
               package: 'mock-messaging',
               adapter: 'MockMessaging',
               config: {}
            }
         }

         readSpy.mockReturnValue(JSON.stringify(config))

         await AppBootloader.bootstrap('quatrain-test.json')

         expect(Log.info).toHaveBeenCalledWith(expect.stringContaining('[Bootloader] Initializing application'))
         expect(Backend.addBackend).toHaveBeenCalled()
         expect(Auth.addProvider).toHaveBeenCalled()
         expect(Queue.addQueue).toHaveBeenCalled()
         expect(Storage.addStorage).toHaveBeenCalled()
         expect(Messaging.addMessager).toHaveBeenCalled()
      })

      it('should catch and log loading errors gracefully on package load failures', async () => {
         const config = {
            backend: {
               package: 'invalid-backend-package',
               adapter: 'InvalidBackend',
               config: {}
            }
         }

         readSpy.mockReturnValue(JSON.stringify(config))

         await AppBootloader.bootstrap('quatrain-test.json')

         expect(Log.error).toHaveBeenCalledWith(
            expect.stringContaining('[Bootloader] Failed to load backend')
         )
      })
   })
})
