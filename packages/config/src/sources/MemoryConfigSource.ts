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
   get(key: string): unknown | undefined {
      if (!isSafePath(key)) {
         return undefined
      }

      if (this._store.has(key)) {
         return this._store.get(key)
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
         if (!Object.prototype.hasOwnProperty.call(dict, part)) {
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
