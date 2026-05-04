import type { StorageAdapterInterface, FileType } from '@quatrain/storage'
import { Log } from '@quatrain/log'
import { CacheAdapterInterface } from './CacheAdapterInterface'

export class MediaCacheProxy {
   protected _storage: StorageAdapterInterface
   protected _cache: CacheAdapterInterface
   protected _ttl: number

   /**
    * @param storage The underlying Quatrain StorageAdapter
    * @param cache The CacheAdapterInterface instance
    * @param ttl Time-to-live in seconds for the cached media binary. Defaults to 600s (10 min).
    */
   constructor(
      storage: StorageAdapterInterface,
      cache: CacheAdapterInterface,
      ttl: number = 600
   ) {
      this._storage = storage
      this._cache = cache
      this._ttl = ttl
   }

   /**
    * Fetches a media file, trying Cache first, and falling back to the StorageAdapter.
    * @returns The file binary data as a Buffer
    */
   public async getMedia(file: FileType): Promise<Buffer> {
      const cacheKey = `media:${file.ref}`

      try {
         const cached = await this._cache.getBuffer(cacheKey)
         if (cached) {
            Log.debug(`[MediaCacheProxy] Cache HIT for ${file.ref}`)
            return cached
         }
      } catch (e) {
         Log.warn(`[MediaCacheProxy] Failed to read from Cache for ${file.ref}: ${e}`)
      }

      Log.debug(`[MediaCacheProxy] Cache MISS for ${file.ref}. Downloading via StorageAdapter...`)

      const stream = await this._storage.getReadable(file)
      
      const buffer = await new Promise<Buffer>((resolve, reject) => {
         const chunks: Buffer[] = []
         stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
         stream.on('error', (err) => reject(err))
         stream.on('end', () => resolve(Buffer.concat(chunks)))
      })

      if (this._ttl > 0) {
         this._cache.set(cacheKey, buffer, this._ttl).catch(e => {
            Log.warn(`[MediaCacheProxy] Failed to write cache for ${file.ref}: ${e}`)
         })
      }

      return buffer
   }
}
