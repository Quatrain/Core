import { Backend } from './Backend'
import { Filter } from './Filter'
import { Limits } from './Limits'
import { Sorting } from './Sorting'
import { SortAndLimit } from './SortAndLimit'
import { BackendInterface } from './types/BackendInterface'
import { OperatorKeys } from './types/OperatorsKeys'
import { DataObjectClass } from './types/DataObjectClass'
import { PersistedBaseObject } from './PersistedBaseObject'
import { ObjectUri, returnAs } from '@quatrain/core'

export const AS_OBJECTURIS = 'objectUris'
export const AS_DATAOBJECTS = 'dataObjects'
export const AS_INSTANCES = 'classInstances'

export type QueryMetaType = {
   count: number
   offset: number
   batch: number
   executionTime: string | number
   sortField?: string
   sortOrder?: 'asc' | 'desc'
   debug?: any
}

export type QueryResultType<T> = {
   items: Array<T>
   meta: QueryMetaType
}

/**
 * A fluent interface for building and executing database queries across all backend adapters.
 * Manages filters, sort orders, and pagination limits dynamically.
 * 
 * @example
 * ```typescript
 * const query = new Query(User);
 * query.where('status', 'active').sortBy('createdAt', 'desc').batch(20);
 * const results = await query.execute(returnAs.AS_INSTANCES);
 * ```
 */
export class Query<T extends typeof PersistedBaseObject> {
   protected _obj: T
   protected _parent: T | undefined

   /** Array of instantiated `Filter` objects defining the query conditions. */
   filters: Filter[]
   /** Array of `Sorting` conditions dictating the order of returned results. */
   sortings: Sorting[]
   /** Pagination rules defining limits, batches, and offsets. */
   limits: Limits
   /** Execution metadata populated by the backend after fetching (e.g. total count, execution time). */
   meta: any

   constructor(obj: T, parent?: T) {
      this._obj = obj
      this._parent = parent
      this.filters = []
      this.sortings = []
      this.limits = new Limits()
      this.meta = {}
   }

   get obj() {
      return this._obj
   }

   get parent(): T | undefined {
      return this._parent
   }

   /**
    * Declare query parent record
    * This may be need in some NoSQL backend to query subcollections
    */
   set parent(parent: T | undefined) {
      this._parent = parent
   }

   /**
    * Updates the parent property of the current object.
    * This method is useful for SQL backends where a model may have two parent records
    * and requires dynamically setting the name of one of them.
    */
   setParentName(parent: string) {
      this._obj.PARENT_PROP = parent
   }
   /**
    * Appends a new filter condition to the query.
    * Can accept an instantiated `Filter` object or raw field parameters.
    * 
    * @param param - The `Filter` object or the string name of the field to filter on.
    * @param value - The value to match (ignored if param is a `Filter`).
    * @param operator - The `OperatorKeys` comparison operator (e.g., equals, gt, lt). Defaults to `equals`.
    * @returns The query instance for chaining.
    */
   where(
      param: Filter | string | any,
      value: any = null,
      operator: OperatorKeys = OperatorKeys.equals
   ) {
      if (typeof param == 'object') {
         this.filters.push(param)
      } else {
         if (operator === OperatorKeys.equals && Array.isArray(value)) {
            // auto-convert operator if value is an array
            operator = OperatorKeys.contains
         }
         this.filters.push(new Filter(param, value, operator))
      }

      return this
   }

   /**
    * Specifies a sorting rule for the query results.
    * 
    * @param param - The `Sorting` object or the string name of the field to sort by.
    * @param order - The direction of the sort: `'asc'` or `'desc'`.
    * @returns The query instance for chaining.
    */
   sortBy(param: Sorting | string, order: any = 'asc') {
      if (typeof param == 'object') {
         this.sortings.push(param)
      } else {
         this.sortings.push(new Sorting(param, order))
      }

      return this
   }

   /**
    * Directly assigns a preconfigured `Limits` object for pagination.
    * 
    * @param limits - The `Limits` pagination configuration.
    * @returns The query instance for chaining.
    */
   setLimits(limits: Limits) {
      this.limits = limits
      return this
   }

   /**
    * Sets the starting offset for pagination.
    * 
    * @param offset - The number of records to skip before returning results. Defaults to 0.
    * @returns The query instance for chaining.
    */
   offset(offset: number = 0) {
      this.limits.offset = offset
      return this
   }

   /**
    * Sets the maximum number of records to return (batch size).
    * 
    * @param batch - The limit of records to fetch. Defaults to 10.
    * @returns The query instance for chaining.
    */
   batch(batch: number = 10) {
      this.limits.batch = batch
      return this
   }

   get sortAndLimit() {
      return new SortAndLimit(this.sortings, this.limits)
   }

   /**
    * Internal: Executes the query against the backend and returns raw `DataObjectClass` wrappers.
    * 
    * @param backend - The backend adapter to query against. Defaults to the global default backend.
    * @returns A promise resolving to the raw DataObject results and execution metadata.
    */
   async fetch(
      backend: BackendInterface = Backend.getBackend()
   ): Promise<QueryResultType<DataObjectClass<any>>> {
      return backend.query(this)
   }

   /**
    * Executes the query and returns only the `ObjectUri` references of the matching records.
    * Efficient for relational operations where full object hydration is unnecessary.
    * 
    * @param backend - The backend adapter to query against.
    * @returns A promise resolving to an array of URIs.
    */
   async fetchAsUri(
      backend: BackendInterface = Backend.getBackend()
   ): Promise<QueryResultType<ObjectUri>> {
      const { items, meta } = await this.fetch(backend)

      return { items: await Promise.all(items.map((dao) => dao.uri)), meta }
   }

   /**
    * Executes the query and fully hydrates the results into instances of the target class.
    * This is the standard data retrieval path for applications.
    * 
    * @param backend - The backend adapter to query against.
    * @returns A promise resolving to an array of fully instantiated model classes.
    */
   async fetchAsInstances(
      backend: BackendInterface = Backend.getBackend()
   ): Promise<QueryResultType<T>> {
      const { items, meta } = await this.fetch(backend)

      const instances = []

      for (const item of items) {
         instances.push(this._obj.fromDataObject(item))
      }

      return { items: instances, meta }
   }

   /**
    * Primary execution handler for the query. Transforms the output based on the requested `returnAs` format.
    * 
    * @param as - The desired output format (`AS_DATAOBJECTS`, `AS_OBJECTURIS`, or `AS_INSTANCES`).
    * @param backend - The backend adapter to query against.
    * @returns A promise resolving to the query results in the specified format.
    * @throws {Error} If an unknown output mode is requested.
    */
   async execute(
      as: returnAs = returnAs.AS_DATAOBJECTS,
      backend: BackendInterface = Backend.getBackend()
   ): Promise<QueryResultType<any>> {
      try {
         switch (as) {
            case AS_DATAOBJECTS:
               return await this.fetch(backend)

            case AS_OBJECTURIS:
               return await this.fetchAsUri(backend)

            case AS_INSTANCES:
               return await this.fetchAsInstances(backend)

            default:
               throw new Error(`Unknown output mode`)
         }
      } catch (err) {
         console.log(err)
         throw err
      }
   }

   /**
    * Executes a sum aggregation query on the target property.
    * 
    * @param property - The name of the numeric property to sum.
    * @param backend - The backend adapter to query against. Defaults to the global default backend.
    * @returns A promise resolving to the sum of the property values.
    */
   async sum(
      property: string,
      backend: BackendInterface = Backend.getBackend()
   ): Promise<number> {
      return backend.aggregate(this, 'sum', property)
   }

   /**
    * Executes an average aggregation query on the target property.
    * 
    * @param property - The name of the numeric property to average.
    * @param backend - The backend adapter to query against. Defaults to the global default backend.
    * @returns A promise resolving to the average of the property values.
    */
   async average(
      property: string,
      backend: BackendInterface = Backend.getBackend()
   ): Promise<number> {
      return backend.aggregate(this, 'avg', property)
   }

   /**
    * Executes a distinct aggregation query on the target property.
    * 
    * @param property - The name of the property.
    * @param backend - The backend adapter to query against. Defaults to the global default backend.
    * @returns A promise resolving to an array of unique values.
    */
   async distinct(
      property: string,
      backend: BackendInterface = Backend.getBackend()
   ): Promise<any[]> {
      return backend.aggregate(this, 'distinct', property)
   }

   /**
    * Executes a minimum aggregation query on the target property.
    * 
    * @param property - The name of the property.
    * @param backend - The backend adapter to query against. Defaults to the global default backend.
    * @returns A promise resolving to the minimum value found, or undefined.
    */
   async min(
      property: string,
      backend: BackendInterface = Backend.getBackend()
   ): Promise<number | undefined> {
      return backend.aggregate(this, 'min', property)
   }

   /**
    * Executes a maximum aggregation query on the target property.
    * 
    * @param property - The name of the property.
    * @param backend - The backend adapter to query against. Defaults to the global default backend.
    * @returns A promise resolving to the maximum value found, or undefined.
    */
   async max(
      property: string,
      backend: BackendInterface = Backend.getBackend()
   ): Promise<number | undefined> {
      return backend.aggregate(this, 'max', property)
   }

   /**
    * Executes a count aggregation query.
    * 
    * @param backend - The backend adapter to query against. Defaults to the global default backend.
    * @returns A promise resolving to the count of matching items.
    */
   async count(
      backend: BackendInterface = Backend.getBackend()
   ): Promise<number> {
      return backend.aggregate(this, 'count')
   }
}
