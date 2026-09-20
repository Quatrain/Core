import { AbstractConfigSource, isSafeKey, isSafePath } from './AbstractConfigSource'

/**
 * In-memory configuration source for runtime programmatic overrides and unit testing.
 */
export class MemoryConfigSource extends AbstractConfigSource {
   readonly name: string
   readonly priority: number
   protected _store: Map<string, unknown>

   /**
    * Construct a new MemoryConfigSource.
    *
    * @param initialData - Optional initial key-value configuration.
    * @param name - Source identifier (defaults to 'memory').
    * @param priority - Source priority (defaults to 100).
    */
   constructor(
      initialData?: Record<string, unknown>,
      name = 'memory',
      priority = 100,
   ) {
      super()
      this.name = name
      this.priority = priority
      this._store = new Map<string, unknown>()

      if (initialData) {
         for (const key of Object.keys(initialData)) {
            if (isSafePath(key)) {
               this._store.set(key, Reflect.get(initialData, key))
            }
         }
      }
   }

   /**
    * Set a value in the memory store.
    * Supports dot notation (e.g. 'database.host').
    *
    * @param key - Property key or dot-notation path.
    * @param value - Value to set.
    */
   set(key: string, value: unknown): void {
      if (!isSafePath(key)) {
         return
      }

      this._store.set(key, value)
   }

   /**
    * Retrieve a value from memory store.
    *
    * @param key - Property key or dot-notation path.
    * @returns Value if present, or undefined.
    */
   get(key: string): unknown {
      if (!isSafePath(key)) {
         return undefined
      }

      if (this._store.has(key)) {
         return this._store.get(key)
      }

      // Check if key is a prefix for nested sub-paths (e.g. 'services.mail' for 'services.mail.smtp.host')
      const prefix = `${key}.`
      let hasSubKeys = false
      const subTree: Record<string, unknown> = {}

      for (const [storedKey, val] of this._store.entries()) {
         if (storedKey.startsWith(prefix)) {
            hasSubKeys = true
            const subPath = storedKey.slice(prefix.length)
            const parts = subPath.split('.')
            let current = subTree

            for (let i = 0; i < parts.length - 1; i++) {
               const part = parts[i]
               if (!isSafeKey(part)) {
                  continue
               }
               const existing = Reflect.get(current, part)
               if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
                  const nextObj: Record<string, unknown> = {}
                  Reflect.set(current, part, nextObj)
                  current = nextObj
               } else {
                  current = existing as Record<string, unknown>
               }
            }

            const lastKey = parts[parts.length - 1]
            if (isSafeKey(lastKey)) {
               Reflect.set(current, lastKey, val)
            }
         }
      }

      if (hasSubKeys) {
         return subTree
      }

      if (!key.includes('.')) {
         return undefined
      }

      const parts = key.split('.')
      const rootKey = parts[0]
      if (!isSafeKey(rootKey) || !this._store.has(rootKey)) {
         return undefined
      }

      let current: unknown = this._store.get(rootKey)
      const subParts = parts.slice(1)
      for (const part of subParts) {
         if (!isSafeKey(part) || typeof current !== 'object' || current === null) {
            return undefined
         }
         const dict = current as Record<string, unknown>
         if (!Object.hasOwn(dict, part)) {
            return undefined
         }
         current = Reflect.get(dict, part)
      }

      return current
   }

   /**
    * Checks if a key exists in the store.
    *
    * @param key - Property key or dot-notation path.
    * @returns True if key exists.
    */
   has(key: string): boolean {
      return this.get(key) !== undefined
   }

   /**
    * Returns all stored entries.
    */
   getAll(): Record<string, unknown> {
      const result: Record<string, unknown> = {}
      for (const [key, val] of this._store.entries()) {
         if (isSafeKey(key)) {
            Reflect.set(result, key, val)
         }
      }
      return result
   }
}
