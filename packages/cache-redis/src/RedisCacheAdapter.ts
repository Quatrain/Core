import { CacheAdapterInterface } from '@quatrain/cache'
import { RedisManager } from './RedisManager'
import { RedisOptions } from 'ioredis'

export class RedisCacheAdapter implements CacheAdapterInterface {
   private _manager: RedisManager

   constructor(options?: RedisOptions | string) {
      this._manager = RedisManager.getInstance(options)
   }

   public get manager(): RedisManager {
      return this._manager
   }

   public async get(key: string): Promise<string | null> {
      return this._manager.client.get(key)
   }

   public async getBuffer(key: string): Promise<Buffer | null> {
      return this._manager.client.getBuffer(key)
   }

   public async set(key: string, value: string | Buffer, ttlSeconds?: number): Promise<void> {
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
         await this._manager.client.set(key, value, 'EX', ttlSeconds)
      } else {
         await this._manager.client.set(key, value)
      }
   }

   public async del(...keys: string[]): Promise<void> {
      if (keys.length > 0) {
         await this._manager.client.del(...keys)
      }
   }

   public async keys(pattern: string): Promise<string[]> {
      return this._manager.client.keys(pattern)
   }
}
