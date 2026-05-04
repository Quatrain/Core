import type BackendMiddleware from '@quatrain/backend/src/middlewares/Middleware'
import { BackendAction } from '@quatrain/backend'
import { DataObjectClass } from '@quatrain/core'
import { Log } from '@quatrain/log'
import { Cache } from './Cache'

export type PrefixResolver = (dataObject: DataObjectClass<any>, action: BackendAction) => string[]

export class CacheInvalidateMiddleware implements BackendMiddleware {
   protected _prefixResolver: PrefixResolver

   /**
    * @param prefixes Either an array of string prefixes (e.g. ['/invoice', '/invoice/items']) 
    *                 or a function returning an array of string prefixes.
    */
   constructor(prefixes?: string[] | PrefixResolver) {
      if (typeof prefixes === 'function') {
         this._prefixResolver = prefixes
      } else if (Array.isArray(prefixes)) {
         this._prefixResolver = () => prefixes
      } else {
         // Default generic behavior: invalidate by collection name (e.g. 'cache:collection:*')
         this._prefixResolver = (dataObject: DataObjectClass<any>) => {
            const collection = dataObject.uri?.collection
            return collection ? [`${collection}`] : []
         }
      }
   }

   public async afterExecute(
      dataObject: DataObjectClass<any>,
      action: BackendAction,
      params?: any
   ): Promise<void> {
      if (
         action === BackendAction.CREATE ||
         action === BackendAction.UPDATE ||
         action === BackendAction.DELETE
      ) {
         const prefixes = this._prefixResolver(dataObject, action)
         
         if (!prefixes || prefixes.length === 0) {
            return
         }

         const caches = Cache.getAll()
         if (caches.length === 0) {
            Log.debug(`[CacheInvalidateMiddleware] No caches configured in registry. Skipping invalidation.`)
            return
         }

         for (const prefix of prefixes) {
            // Depending on how keys are stored in cache, we append a wildcard to match all nested payloads.
            // Adjust this wildcard depending on the specific cache implementation's pattern matching style.
            const pattern = prefix.endsWith('*') ? prefix : `${prefix}*`

            for (const cache of caches) {
               try {
                  const keys = await cache.keys(pattern)
                  if (keys.length > 0) {
                     await cache.del(...keys)
                     Log.info(`[CacheInvalidateMiddleware] Invalidated ${keys.length} keys matching ${pattern} on cache adapter.`)
                  }
               } catch (e) {
                  Log.error(`[CacheInvalidateMiddleware] Failed to invalidate cache pattern ${pattern}: ${e}`)
               }
            }
         }
      }
   }
}
