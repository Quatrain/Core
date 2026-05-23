import { BaseProperty, BasePropertyType } from './BaseProperty'
import { ObjectUri } from '../components/ObjectUri'
import { Core } from '../Core'
import { DataObjectClass } from '../components/types/DataObjectClass'
import { BaseObject } from '../components/BaseObject'

/**
 * Configuration dictionary for instantiating a core `CollectionProperty`.
 * Defines a relationship containing multiple objects.
 *
 * | Parameter | Type | Description | Default |
 * | :--- | :--- | :--- | :--- |
 * | `instanceOf` | typeof BaseObject | The class of the objects contained in this collection. | **Required** |
 * | `backend` | any | An optional specific backend instance for persistence handling. | `undefined` |
 * | `parentKey` | string | The foreign key field pointing back to the parent. | `parent.uri.collection` |
 */
export interface CollectionPropertyType extends BasePropertyType {
   instanceOf: typeof BaseObject
   backend?: any
   parentKey?: string
}

/**
 * A basic relational property type representing a collection of `BaseObject` instances.
 * This core class manages the in-memory array representation. For dynamic querying, see the backend `CollectionProperty`.
 * 
 * @example
 * ```typescript
 * const permissions = new CollectionProperty({
 *    name: 'permissions',
 *    instanceOf: Permission
 * });
 * ```
 */
export class CollectionProperty extends BaseProperty {
   /** The string literal type identifier for this property. */
   static TYPE = 'collection'
   protected _value:
      | Array<any>
      | Array<DataObjectClass<any>>
      | Array<ObjectUri>
      | undefined = undefined
   protected _instanceOf: typeof BaseObject
   protected _parentKey: string

   constructor(config: CollectionPropertyType) {
      super(config)
      if (!config.instanceOf) {
         throw new Error(`Parameter 'instanceOf' is mandatory`)
      }
      this._instanceOf =
         typeof config.instanceOf === 'string'
            ? Core.classRegistry[config.instanceOf]
            : config.instanceOf
      this._parentKey =
         config.parentKey || this._parent?.uri?.collection || 'unknown'
   }

   /**
    * Assigns an array of related objects or URIs to the collection.
    * 
    * @param value - The array of elements to assign.
    * @param setChanged - Whether to mark the property as modified.
    * @returns The property instance for chaining.
    */
   set(value: Array<any>, setChanged = true) {
      return super.set(value, setChanged)
   }

   /**
    * Serializes the collection for JSON output.
    * 
    * @returns The raw array of values.
    */
   toJSON() {
      return this._value
   }

   /**
    * Sums the numeric values of a property across items in the collection.
    * Can aggregate either the internal collection value or an external array.
    * 
    * @param property - The name of the property to sum.
    * @param items - Optional external items array. Defaults to the internal collection array.
    * @returns The sum of all numeric values.
    */
   /**
    * Sums the numeric values of a property across items in the collection.
    * Can aggregate either the internal collection value or an external array.
    * 
    * @param property - The name of the property to sum.
    * @param items - Optional external items array. Defaults to the internal collection array.
    * @returns The sum of all numeric values.
    */
   sum(property: string, items: any[] = this._value || []): number | Promise<number> {
      return items.reduce((acc, item) => {
         const val = typeof item.val === 'function' ? item.val(property) : item[property]
         const num = Number(val)
         return acc + (Number.isNaN(num) ? 0 : num)
      }, 0)
   }

   /**
    * Calculates the average of the numeric values of a property across items in the collection.
    * Can aggregate either the internal collection value or an external array.
    * 
    * @param property - The name of the property to average.
    * @param items - Optional external items array. Defaults to the internal collection array.
    * @returns The average of all numeric values, or 0 if empty.
    */
   average(property: string, items: any[] = this._value || []): number | Promise<number> {
      if (items.length === 0) return 0
      const sumVal = this.sum(property, items)
      if (sumVal && typeof (sumVal as any).then === 'function') {
         return (sumVal as any).then((s: number) => s / items.length)
      }
      return (sumVal as number) / items.length
   }

   /**
    * Retrieves all distinct values of a property across the collection items.
    * Can aggregate either the internal collection value or an external array.
    * 
    * @param property - The name of the property.
    * @param items - Optional external items array. Defaults to the internal collection array.
    * @returns An array of unique property values.
    */
   distinct(property: string, items: any[] = this._value || []): any[] | Promise<any[]> {
      const values = items.map((item) => {
         return typeof item.val === 'function' ? item.val(property) : item[property]
      })
      return Array.from(new Set(values))
   }

   /**
    * Returns the minimum value of a numeric property across the collection items.
    * Can aggregate either the internal collection value or an external array.
    * 
    * @param property - The name of the property.
    * @param items - Optional external items array. Defaults to the internal collection array.
    * @returns The minimum numeric value found, or undefined if no valid numbers are present.
    */
   min(property: string, items: any[] = this._value || []): number | undefined | Promise<number | undefined> {
      if (items.length === 0) return undefined
      let minVal: number | undefined = undefined
      items.forEach((item) => {
         const val = typeof item.val === 'function' ? item.val(property) : item[property]
         const num = Number(val)
         if (!Number.isNaN(num)) {
            if (minVal === undefined || num < minVal) {
               minVal = num
            }
         }
      })
      return minVal
   }

   /**
    * Returns the maximum value of a numeric property across the collection items.
    * Can aggregate either the internal collection value or an external array.
    * 
    * @param property - The name of the property.
    * @param items - Optional external items array. Defaults to the internal collection array.
    * @returns The maximum numeric value found, or undefined if no valid numbers are present.
    */
   max(property: string, items: any[] = this._value || []): number | undefined | Promise<number | undefined> {
      if (items.length === 0) return undefined
      let maxVal: number | undefined = undefined
      items.forEach((item) => {
         const val = typeof item.val === 'function' ? item.val(property) : item[property]
         const num = Number(val)
         if (!Number.isNaN(num)) {
            if (maxVal === undefined || num > maxVal) {
               maxVal = num
            }
         }
      })
      return maxVal
   }

   /**
    * Groups the collection items by the values of a specific property.
    * Can aggregate either the internal collection value or an external array.
    * 
    * @param property - The name of the property to group by.
    * @param items - Optional external items array. Defaults to the internal collection array.
    * @returns A dictionary object where keys are the property values and values are arrays of matching items.
    */
   groupBy(property: string, items: any[] = this._value || []): Record<string, any[]> | Promise<Record<string, any[]>> {
      const groups: Record<string, any[]> = {}
      items.forEach((item) => {
         const val = typeof item.val === 'function' ? item.val(property) : item[property]
         const key = String(val ?? 'undefined')
         if (!groups[key]) {
            groups[key] = []
          }
         groups[key].push(item)
      })
      return groups
   }

   /**
    * Plucks a specific property from each item in the collection.
    * Can aggregate either the internal collection value or an external array.
    * 
    * @param property - The name of the property to extract.
    * @param items - Optional external items array. Defaults to the internal collection array.
    * @returns An array containing the extracted property values.
    */
   pluck(property: string, items: any[] = this._value || []): any[] | Promise<any[]> {
      return items.map((item) => {
         return typeof item.val === 'function' ? item.val(property) : item[property]
      })
   }

   /**
    * Returns the count of items in the collection, optionally filtered by a predicate callback.
    * Can aggregate either the internal collection value or an external array.
    * 
    * @param predicate - An optional filter callback to run on each item.
    * @param items - Optional external items array. Defaults to the internal collection array.
    * @returns The count of matching items.
    */
   count(predicate?: (item: any) => boolean, items: any[] = this._value || []): number | Promise<number> {
      if (!predicate) return items.length
      return items.filter(predicate).length
   }

   /**
    * Applies an anonymous function to each item in the collection.
    * Can execute either on the internal collection value or an external array.
    * Supporting both synchronous and asynchronous callback functions.
    * 
    * @param fn - The anonymous callback function to apply to each item.
    * @param items - Optional external items array. Defaults to the internal collection array.
    * @returns The results of the function applications (or a Promise resolving to the results if async).
    */
   apply(
      fn: (item: any) => any | Promise<any>,
      items: any[] = this._value || []
   ): any[] | Promise<any[]> {
      const results = items.map((item) => fn(item))
      if (results.some((r) => r && typeof r.then === 'function')) {
         return Promise.all(results)
      }
      return results
   }
}
