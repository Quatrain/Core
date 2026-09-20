import { AbstractConfigSource, isSafeKey } from './AbstractConfigSource'

/**
 * Configuration source that wraps a structured JavaScript object or parsed JSON data.
 */
export class ObjectConfigSource extends AbstractConfigSource {
   readonly name: string
   readonly priority: number
   protected _data: Record<string, unknown>

   /**
    * Construct a new ObjectConfigSource.
    *
    * @param data - Object containing configuration data.
    * @param name - Source identifier (defaults to 'object').
    * @param priority - Priority level (defaults to 10).
    */
   constructor(
      data: Record<string, unknown>,
      name = 'object',
      priority = 10,
   ) {
      super()
      this.name = name
      this.priority = priority
      this._data = data
   }

   /**
    * Retrieve value by key or dot-notation path.
    *
    * @param key - Property key or dot-notation path.
    * @returns Value if present, or undefined.
    */
   get(key: string): unknown {
      if (!isSafeKey(key)) {
         return undefined
      }

      if (Object.hasOwn(this._data, key)) {
         return Reflect.get(this._data, key)
      }

      if (!key.includes('.')) {
         return undefined
      }

      const parts = key.split('.')
      let current: unknown = this._data

      for (const part of parts) {
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
    * Checks if a key or path exists.
    *
    * @param key - Property key or dot-notation path.
    * @returns True if key exists.
    */
   has(key: string): boolean {
      return this.get(key) !== undefined
   }

   /**
    * Returns all data from this object source.
    */
   getAll(): Record<string, unknown> {
      return { ...this._data }
   }
}
