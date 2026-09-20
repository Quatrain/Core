import { AbstractConfigSource } from './AbstractConfigSource'

/**
 * In-memory configuration source for runtime programmatic overrides and unit testing.
 */
export class MemoryConfigSource extends AbstractConfigSource {
   readonly name: string
   readonly priority: number
   protected _store: Record<string, unknown>

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
      this._store = {}

      if (initialData) {
         for (const key of Object.keys(initialData)) {
            this._store[key] = initialData[key]
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
      if (!key.includes('.')) {
         this._store[key] = value
         return
      }

      const parts = key.split('.')
      let current: Record<string, unknown> = this._store

      for (let i = 0; i < parts.length - 1; i++) {
         const part = parts[i]
         if (typeof current[part] !== 'object' || current[part] === null) {
            current[part] = {}
         }
         current = current[part] as Record<string, unknown>
      }

      const lastPart = parts[parts.length - 1]
      current[lastPart] = value
   }

   /**
    * Retrieve a value from memory store.
    *
    * @param key - Property key or dot-notation path.
    * @returns Value if present, or undefined.
    */
   get(key: string): unknown | undefined {
      if (Object.prototype.hasOwnProperty.call(this._store, key)) {
         return this._store[key]
      }

      if (!key.includes('.')) {
         return undefined
      }

      const parts = key.split('.')
      let current: unknown = this._store

      for (const part of parts) {
         if (typeof current !== 'object' || current === null) {
            return undefined
         }
         const dict = current as Record<string, unknown>
         if (!Object.prototype.hasOwnProperty.call(dict, part)) {
            return undefined
         }
         current = dict[part]
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
      return { ...this._store }
   }
}
