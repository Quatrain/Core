import { Cache } from './Cache'
import { CacheAdapterInterface } from './CacheAdapterInterface'

class MockCacheAdapter implements CacheAdapterInterface {
   private store = new Map<string, any>()
   
   async get(key: string): Promise<any> {
      return this.store.get(key)
   }
   async set(key: string, value: any, ttl?: number): Promise<boolean> {
      this.store.set(key, value)
      return true
   }
   async del(...keys: string[]): Promise<number> {
      let count = 0
      for (const key of keys) {
         if (this.store.delete(key)) {
            count++
         }
      }
      return count
   }
   async keys(pattern: string): Promise<string[]> {
      const match = pattern.replace('*', '')
      return Array.from(this.store.keys()).filter(k => k.startsWith(match))
   }
   async clear(): Promise<boolean> {
      this.store.clear()
      return true
   }
}

describe('Cache', () => {
   beforeEach(() => {
      Cache.clearRegistry()
   })

   it('should register and retrieve cache adapters', () => {
      const adapter = new MockCacheAdapter()
      Cache.register('test', adapter)
      
      expect(Cache.get('test')).toBe(adapter)
      expect(Cache.get('non-existent')).toBeUndefined()
      
      expect(Cache.getAll()).toEqual([adapter])
   })

   it('should unregister cache adapters', () => {
      const adapter = new MockCacheAdapter()
      Cache.register('test', adapter)
      expect(Cache.get('test')).toBe(adapter)

      Cache.unregister('test')
      expect(Cache.get('test')).toBeUndefined()
   })
})
