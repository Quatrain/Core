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

      const subTree = this._extractSubTree(key)
      if (subTree !== undefined) {
         return subTree
      }

      if (key.includes('.')) {
         return this._resolveNestedKey(key)
      }

      return undefined
   }

   /**
    * Extracts nested configuration object if key is a prefix for stored paths.
    */
   protected _extractSubTree(key: string): Record<string, unknown> | undefined {
      const prefix = `${key}.`
      let hasSubKeys = false
      const subTree: Record<string, unknown> = {}

      for (const [storedKey, val] of this._store.entries()) {
         if (storedKey.startsWith(prefix)) {
            hasSubKeys = true
            const subPath = storedKey.slice(prefix.length)
            this._assignSubPath(subTree, subPath, val)
         }
      }

      return hasSubKeys ? subTree : undefined
   }

   /**
    * Helper assigning a nested value into the target sub-tree.
    */
   protected _assignSubPath(
      subTree: Record<string, unknown>,
      subPath: string,
      val: unknown,
   ): void {
      const parts = subPath.split('.')
      const lastKey = parts.pop()
      let current = subTree

      for (const part of parts) {
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

      if (lastKey !== undefined && isSafeKey(lastKey)) {
         Reflect.set(current, lastKey, val)
      }
   }

   /**
    * Resolves dot-notation path traversing an in-memory object tree.
    */
   protected _resolveNestedKey(key: string): unknown {
      const parts = key.split('.')
      const [rootKey, ...subParts] = parts
      if (!rootKey || !isSafeKey(rootKey) || !this._store.has(rootKey)) {
         return undefined
      }

      let current: unknown = this._store.get(rootKey)
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
