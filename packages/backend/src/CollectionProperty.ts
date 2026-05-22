import {
   CollectionProperty as CoreCollectionProperty,
   BasePropertyType,
   returnAs,
} from '@quatrain/core'
import { Backend } from './Backend'
import { Filter } from './Filter'
import { Query, QueryResultType } from './Query'
import { PersistedBaseObject } from './PersistedBaseObject'

/**
 * Configuration dictionary for instantiating a backend `CollectionProperty`.
 * This extends `BasePropertyType` with specific relational and backend-aware parameters.
 *
 * | Parameter | Type | Description | Default |
 * | :--- | :--- | :--- | :--- |
 * | `instanceOf` | typeof PersistedBaseObject | The class of the objects contained in this collection. | **Required** |
 * | `backend` | any | An optional specific backend instance to query. If omitted, uses the default backend. | `undefined` |
 * | `parentKey` | string | The foreign key field on the child objects pointing back to the parent. | `parent.uri.collection` |
 */
export interface CollectionPropertyType extends BasePropertyType {
   instanceOf: typeof PersistedBaseObject
   backend?: any
   parentKey?: string
}

/**
 * A specialized backend property that represents a one-to-many or many-to-many relationship.
 * Unlike the core `CollectionProperty`, this property acts as a dynamic query builder,
 * fetching related `PersistedBaseObject` instances directly from the database when accessed.
 * 
 * @example
 * ```typescript
 * const users = new CollectionProperty({
 *    name: 'employees',
 *    instanceOf: User,
 *    parentKey: 'companyUri' // The field in 'User' that stores the company ID
 * });
 * 
 * // Fetch the collection from the database
 * const results = await users.val();
 * console.log(results); // Array of User objects
 * ```
 */
export class CollectionProperty extends CoreCollectionProperty {
   /** Type identifier for the property registry. */
   static TYPE = 'collection'
   protected declare _instanceOf: typeof PersistedBaseObject
   protected _backend: any
   protected _query: Query<any>
   protected _filters: Filter[] | Filter | undefined = undefined

   constructor(config: CollectionPropertyType) {
      super(config)
      this._backend = config.backend
         ? Backend.getBackend(config.backend)
         : undefined
      this._query = this._setQuery()
   }

   protected _setQuery(filters?: Filter[]) {
      if (typeof this._instanceOf.query !== 'function') {
         return undefined as any
      }
      const query = this._instanceOf.query()
      query.where(this._parentKey, this._parent ? this._parent.uri : 'unknown')
      if (filters) {
         query.filters = filters
      }

      return query
   }

   /**
    * Overrides the default set method. Normally, a backend collection's value
    * is retrieved dynamically via queries, but it can be manually hydrated.
    * 
    * @param value - The array of objects or URIs to set.
    * @param setChanged - Whether to mark the property as modified.
    * @returns The property instance for chaining.
    */
   set(value: Array<any>, setChanged = true) {
      return super.set(value, setChanged)
   }

   /**
    * Constructs or retrieves the backend query builder for this collection.
    * This allows chaining further database conditions before execution.
    * 
    * @param filters - Optional array of filters to apply to the collection query.
    * @returns A Query object ready to be executed against the backend.
    */
   get(filters: Filter[] | undefined = undefined): Query<any> {
      if (!this._query || this._filters !== filters) {
         this._query = this._setQuery(filters)
      } else {
         const parentUri = this._parent ? this._parent.uri : 'unknown'
         const parentFilter = this._query.filters.find(
            (f) => f.prop === this._parentKey
         )
         if (parentFilter) {
            parentFilter.value = parentUri
         }
      }

      return this._query
   }

   /**
    * Executes the backend query and resolves the collection of related objects.
    * 
    * @param transform - The format in which the results should be returned (e.g. AS_DATAOBJECTS).
    * @returns A promise resolving to the query result containing the objects.
    */
   async val(
      transform: returnAs = returnAs.AS_DATAOBJECTS
   ): Promise<QueryResultType<any>> {
      return await this.get().execute(transform, this._backend)
   }

   /**
    * Sums the numeric values of a property across items in the collection.
    * Delegates to database query if not hydrated.
    * 
    * @param property - The name of the property to sum.
    * @returns A promise resolving to the sum of all numeric values.
    */
   async sum(property: string): Promise<number> {
      if (this._value !== undefined) {
         return super.sum(property) as number
      }
      return this.get().sum(property, this._backend)
   }

   /**
    * Calculates the average of the numeric values of a property across items in the collection.
    * Delegates to database query if not hydrated.
    * 
    * @param property - The name of the property to average.
    * @returns A promise resolving to the average of all numeric values.
    */
   async average(property: string): Promise<number> {
      if (this._value !== undefined) {
         return super.average(property) as number
      }
      return this.get().average(property, this._backend)
   }

   /**
    * Retrieves all distinct values of a property across the collection items.
    * Delegates to database query if not hydrated.
    * 
    * @param property - The name of the property.
    * @returns A promise resolving to an array of unique property values.
    */
   async distinct(property: string): Promise<any[]> {
      if (this._value !== undefined) {
         return super.distinct(property) as any[]
      }
      return this.get().distinct(property, this._backend)
   }

   /**
    * Returns the minimum value of a numeric property across the collection items.
    * Delegates to database query if not hydrated.
    * 
    * @param property - The name of the property.
    * @returns A promise resolving to the minimum numeric value found, or undefined.
    */
   async min(property: string): Promise<number | undefined> {
      if (this._value !== undefined) {
         return super.min(property) as number | undefined
      }
      return this.get().min(property, this._backend)
   }

   /**
    * Returns the maximum value of a numeric property across the collection items.
    * Delegates to database query if not hydrated.
    * 
    * @param property - The name of the property.
    * @returns A promise resolving to the maximum numeric value found, or undefined.
    */
   async max(property: string): Promise<number | undefined> {
      if (this._value !== undefined) {
         return super.max(property) as number | undefined
      }
      return this.get().max(property, this._backend)
   }

   /**
    * Groups the collection items by the values of a specific property.
    * Fetches and hydrates the collection first if not already hydrated.
    * 
    * @param property - The name of the property to group by.
    * @returns A promise resolving to a dictionary object.
    */
   async groupBy(property: string): Promise<Record<string, any[]>> {
      if (this._value === undefined) {
         const { items } = await this.val(returnAs.AS_INSTANCES)
         return super.groupBy(property, items) as Record<string, any[]>
      }
      return super.groupBy(property) as Record<string, any[]>
   }

   /**
    * Plucks a specific property from each item in the collection.
    * Fetches and hydrates the collection first if not already hydrated.
    * 
    * @param property - The name of the property to extract.
    * @returns A promise resolving to an array containing the extracted property values.
    */
   async pluck(property: string): Promise<any[]> {
      if (this._value === undefined) {
         const { items } = await this.val(returnAs.AS_INSTANCES)
         return super.pluck(property, items) as any[]
      }
      return super.pluck(property) as any[]
   }

   /**
    * Returns the count of items in the collection, optionally filtered by a predicate callback.
    * If no predicate is provided and the collection is not hydrated, it runs a fast database query.
    * 
    * @param predicate - An optional filter callback to run on each item.
    * @returns A promise resolving to the count of matching items.
    */
   async count(predicate?: (item: any) => boolean): Promise<number> {
      if (predicate) {
         if (this._value === undefined) {
            const { items } = await this.val(returnAs.AS_INSTANCES)
            return super.count(predicate, items) as number
         }
         return super.count(predicate) as number
      }
      if (this._value !== undefined) {
         return super.count() as number
      }
      return this.get().count(this._backend)
   }

   /**
    * Applies an anonymous function to each item in the collection.
    * Fetches fully instantiated model class instances from the database if not hydrated.
    * 
    * @param fn - The anonymous callback function to apply to each item.
    * @returns A promise resolving to the results of the callback applications.
    */
   async apply(fn: (item: any) => any | Promise<any>): Promise<any[]> {
      if (this._value === undefined) {
         const { items } = await this.get().fetchAsInstances(this._backend)
         const results = items.map((item) => fn(item))
         return Promise.all(results)
      }
      const results = this._value.map((item) => fn(item))
      return Promise.all(results)
   }

   /**
    * Serializes the current explicitly set value of the collection.
    * Note: This does not trigger a database fetch.
    * 
    * @returns The raw internal value array.
    */
   toJSON() {
      return this._value
   }
}
