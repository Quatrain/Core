import { BaseProperty, BasePropertyType } from './BaseProperty'

/**
 * Configuration dictionary for instantiating a `MapProperty`.
 * Inherits all core parameters from `BasePropertyType`.
 */
export interface MapPropertyType extends BasePropertyType {}

/**
 * A property type designed to store arbitrary JSON objects or Key-Value maps.
 * 
 * @example
 * ```typescript
 * const metadata = new MapProperty({
 *    name: 'metadata',
 *    defaultValue: {}
 * });
 * 
 * metadata.set({ theme: 'dark', version: 2 });
 * ```
 */
export class MapProperty extends BaseProperty {
   /** The string literal type identifier for this property. */
   static TYPE = 'map'

   /**
    * Assigns a new object or map to the property.
    * 
    * @param value - The object to assign. Must be of type 'object'.
    * @param setChanged - Whether to mark the property as modified.
    * @returns The property instance for chaining.
    * @throws {Error} If the provided value is not an object.
    */
   set(value: any, setChanged = true) {
      if (typeof value! !== 'object') {
         throw new Error(`value ${JSON.stringify(value)} is not an object`)
      }

      return super.set(value, setChanged)
   }

   /**
    * Serializes the map property for database storage.
    * 
    * @returns A JSON string representation of the map, or an empty object.
    */
   toJSON() {
      return this._value ? JSON.stringify(this._value) : {}
   }
}
