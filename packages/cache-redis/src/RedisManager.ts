import Redis, { RedisOptions } from 'ioredis'
import { Log } from '@quatrain/log'

export class RedisManager {
   private static _instance: RedisManager
   private _client: Redis

   private constructor(options?: RedisOptions | string) {
      if (typeof options === 'string') {
         this._client = new Redis(options)
      } else {
         this._client = new Redis(options || {})
      }

      this._client.on('error', (err) => {
         Log.error(`[Redis] Connection Error: ${err}`)
      })
      
      this._client.on('connect', () => {
         Log.info(`[Redis] Connected successfully.`)
      })
   }

   public static getInstance(options?: RedisOptions | string): RedisManager {
      if (!RedisManager._instance) {
         RedisManager._instance = new RedisManager(options)
      }
      return RedisManager._instance
   }

   public get client(): Redis {
      return this._client
   }
}
