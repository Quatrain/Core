import { CacheInvalidateMiddleware } from './CacheInvalidateMiddleware'
import { Cache } from './Cache'
import { BackendAction } from '@quatrain/backend'
import { DataObject, StringProperty } from '@quatrain/core'
import { CacheAdapterInterface } from './CacheAdapterInterface'

class MockCacheAdapter implements CacheAdapterInterface {
   public store = new Map<string, any>()
   
   async get(key: string): Promise<any> { return this.store.get(key) }
   async set(key: string, value: any, ttl?: number): Promise<boolean> { this.store.set(key, value); return true; }
   async del(...keys: string[]): Promise<number> {
      let count = 0
      for (const key of keys) {
         if (this.store.delete(key)) count++
      }
      return count
   }
   async keys(pattern: string): Promise<string[]> {
      const prefix = pattern.replace('*', '')
      return Array.from(this.store.keys()).filter(k => k.startsWith(prefix))
   }
   async clear(): Promise<boolean> { this.store.clear(); return true; }
}

describe('CacheInvalidateMiddleware', () => {
   let cacheAdapter: MockCacheAdapter

   beforeEach(() => {
      Cache.clearRegistry()
      cacheAdapter = new MockCacheAdapter()
      Cache.register('default', cacheAdapter)
   })

   it('should invalidate cache keys matching collection name by default on CREATE/UPDATE/DELETE', async () => {
      await cacheAdapter.set('entities:1', 'value1')
      await cacheAdapter.set('entities:2', 'value2')
      await cacheAdapter.set('users:1', 'value3')

      const dao = DataObject.factory({ properties: [{ name: 'name', type: StringProperty.TYPE }] })
      dao.uri.collection = 'entities'

      const middleware = new CacheInvalidateMiddleware()
      await middleware.afterExecute(dao, BackendAction.UPDATE)

      // It should delete all keys starting with 'entities'
      expect(await cacheAdapter.get('entities:1')).toBeUndefined()
      expect(await cacheAdapter.get('entities:2')).toBeUndefined()
      expect(await cacheAdapter.get('users:1')).toBe('value3')
   })

   it('should support static prefix arrays', async () => {
      await cacheAdapter.set('customPrefix:1', 'value1')
      await cacheAdapter.set('otherPrefix:1', 'value2')

      const dao = DataObject.factory({ properties: [] })
      const middleware = new CacheInvalidateMiddleware(['customPrefix', 'otherPrefix'])
      await middleware.afterExecute(dao, BackendAction.CREATE)

      expect(await cacheAdapter.get('customPrefix:1')).toBeUndefined()
      expect(await cacheAdapter.get('otherPrefix:1')).toBeUndefined()
   })

   it('should support custom prefix resolver functions', async () => {
      await cacheAdapter.set('resolved:1', 'value1')
      const dao = DataObject.factory({ properties: [] })
      
      const middleware = new CacheInvalidateMiddleware(() => ['resolved'])
      await middleware.afterExecute(dao, BackendAction.DELETE)

      expect(await cacheAdapter.get('resolved:1')).toBeUndefined()
   })

   it('should do nothing if prefix resolver returns an empty array', async () => {
      const dao = DataObject.factory({ properties: [] })
      const middleware = new CacheInvalidateMiddleware(() => [])
      await expect(middleware.afterExecute(dao, BackendAction.UPDATE)).resolves.not.toThrow()
   })

   it('should do nothing if no caches are configured in registry', async () => {
      Cache.clearRegistry()
      const dao = DataObject.factory({ properties: [] })
      const middleware = new CacheInvalidateMiddleware(['prefix'])
      await expect(middleware.afterExecute(dao, BackendAction.UPDATE)).resolves.not.toThrow()
   })

   it('should catch keys retrieval errors safely without throwing', async () => {
      const badCache: any = {
         keys: jest.fn().mockRejectedValue(new Error('Cache error')),
      }
      Cache.clearRegistry()
      Cache.register('bad', badCache)

      const dao = DataObject.factory({ properties: [] })
      const middleware = new CacheInvalidateMiddleware(['prefix'])
      
      const errorSpy = jest.spyOn(require('@quatrain/log').Log, 'error').mockImplementation(() => {})
      await expect(middleware.afterExecute(dao, BackendAction.UPDATE)).resolves.not.toThrow()
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
   })

   it('should handle undefined collection name correctly when default prefix resolver is used', async () => {
      const dao = DataObject.factory({ properties: [] })
      dao.uri.collection = undefined as any
      const middleware = new CacheInvalidateMiddleware()
      await expect(middleware.afterExecute(dao, BackendAction.UPDATE)).resolves.not.toThrow()
   })

   it('should support prefixes that already end with a wildcard *', async () => {
      await cacheAdapter.set('wildcard:1', 'value1')
      const dao = DataObject.factory({ properties: [] })
      const middleware = new CacheInvalidateMiddleware(['wildcard*'])
      await middleware.afterExecute(dao, BackendAction.UPDATE)
      expect(await cacheAdapter.get('wildcard:1')).toBeUndefined()
   })
})
