import {
   Backend,
   BackendAction,
   BackendParameters,
   BackendParametersKeys,
} from './Backend'
import { DataObjectClass } from './types/DataObjectClass'
import { BackendInterface } from './types/BackendInterface'
import { Filter } from './Filter'
import { Filters } from './Filters'
import { Query, QueryResultType } from './Query'
import { SortAndLimit } from './SortAndLimit'
import BackendMiddleware from './middlewares/Middleware'
import { BackendError } from './BackendError'
import { MiddlewareParams } from './middlewares/types/MiddlewareParams'
import { SchemaDelta } from './types/SchemaDelta'
import * as CollectionHierarchy from './types/CollectionHierarchy'

interface BM extends BackendMiddleware {}

/**
 * The baseline abstract class defining the contract for all Quatrain database adapters.
 * Implementations must extend this class to translate agnostic CRUD operations into
 * specific database queries (e.g., PostgreSQL, Firestore).
 * It also handles middleware execution lifecycles.
 */
export abstract class AbstractBackendAdapter implements BackendInterface {
   /** The string identifier for primary keys, mapped to 'id' by default. */
   static PKEY_IDENTIFIER: any = 'id'

   protected _alias: string = ''
   protected _params: BackendParameters = {}
   protected _middlewares: BM[] = []

   constructor(params: BackendParameters = {}) {
      this._alias = params.alias || ''
      this._middlewares = params.middlewares || []
      this._params = params
   }

   /**
    * Overrides or adds a backend configuration parameter dynamically.
    * 
    * @param key - The parameter key to modify.
    * @param value - The new value to assign.
    */
   setParam(key: BackendParametersKeys, value: any) {
      this._params[key] = value
   }

   /**
    * Retrieves a specific configuration parameter.
    * 
    * @param key - The parameter key to fetch.
    * @returns The value associated with the key, or undefined.
    */
   getParam(key: BackendParametersKeys) {
      return this._params[key]
   }

   /**
    * Attaches a new middleware to the adapter's execution pipeline.
    * Middlewares are triggered before or after database actions.
    * 
    * @param middleware - The instantiated middleware to attach.
    * @throws {BackendError} If a middleware with the same class name is already attached.
    */
   addMiddleware(middleware: BM) {
      if (this.hasMiddleware(middleware.constructor.name)) {
         throw new BackendError(
            `Middleware '${middleware.constructor.name}' is already attached`
         )
      }
      this._middlewares.push(middleware)
   }

   /**
    * Removes a middleware from the pipeline by its class name.
    * 
    * @param middlewareClassName - The exact name of the middleware class to remove.
    */
   deleteMiddleware(middlewareClassName: string) {
      this._middlewares = this._middlewares.filter(
         (middleware) => middleware.constructor.name !== middlewareClassName
      )
   }

   /**
    * Returns true if a given middleware is attached
    * @param className
    * @returns boolean
    */
   hasMiddleware(className: string): boolean {
      let has = false
      this._middlewares.forEach((middleware) => {
         if (middleware.constructor.name === className) {
            has = true
         }
      })

      return has
   }

   set alias(alias: string) {
      this._alias = alias
   }

   get alias() {
      return this._alias
   }

   /**
    * Helper method to extract the destination collection name from a DataObject.
    * 
    * @param dao - The DataObject evaluating the context.
    * @returns The resolved collection string.
    */
   getCollection(dao: DataObjectClass<any>) {
      return dao.uri.collection
   }

   /**
    * Adapter-specific implementation for inserting new records.
    * 
    * @param dataObject - The payload.
    * @param desiredUid - Optional explicit UID to use.
    * @returns A promise resolving to the created object.
    */
   abstract create(
      dataObject: DataObjectClass<any>,
      desiredUid?: string | undefined
   ): Promise<DataObjectClass<any>>

   /**
    * Adapter-specific implementation for reading a record by its UID/path.
    * 
    * @param dataObject - Empty object holding the target URI path.
    * @returns A promise resolving to the populated DataObject.
    */
   abstract read(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>>

   /**
    * Adapter-specific implementation for modifying an existing record.
    * 
    * @param dataObject - The modified DataObject payload.
    * @returns A promise resolving to the updated DataObject.
    */
   abstract update(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>>

   /**
    * Adapter-specific implementation for deleting an existing record.
    * 
    * @param dataObject - The object to delete.
    * @returns A promise resolving to the deleted object footprint.
    */
   abstract delete(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>>

   /**
    * Adapter-specific implementation for removing an entire collection.
    * 
    * @param collection - The collection name.
    * @param batchSize - The pagination batch limit for NoSQL sequential deletes.
    */
   abstract deleteCollection(
      collection: string,
      batchSize?: number
   ): Promise<void>

   /**
    * Process Query instance and return result
    * @param query
    * @returns Array
    */
   async query(
      query: Query<any>
   ): Promise<QueryResultType<DataObjectClass<any>>> {
      const dao: DataObjectClass<any> = await query.obj.daoFactory()
      if (query.parent) {
      }
      return await this.find(
         dao,
         query.filters,
         query.sortAndLimit,
         query.parent
      )
   }

   /**
    * Adapter-specific implementation translating complex Query constructs into raw database statements.
    * 
    * @param dataObject - Base template object representing the queried collection.
    * @param filters - The compiled list of WHERE filters.
    * @param pagination - Limits, offsets, and sorting directions.
    * @param parent - Optional linked parent object for nested lookups.
    * @returns A promise resolving to an array of objects and result metadata.
    */
   abstract find(
      dataObject: DataObjectClass<any>,
      filters: Filters | Filter[] | undefined,
      pagination: SortAndLimit | undefined,
      parent: any
   ): Promise<QueryResultType<any>>

   /**
    * Outputs an adapter-level diagnostic message to the console if `debug` mode is enabled.
    * 
    * @param message - The textual content to log.
    * @deprecated Use `Backend.debug()` or `Backend.log()` (which itself is deprecated in favor of specific levels) instead.
    */
   log(message: string) {
      if (this._params['debug'] === true) {
         Backend.debug(message)
      }
   }

   /**
    * Orchestrates the sequential execution of all attached middlewares for a given action.
    * 
    * @param dataObject - The payload traversing the middlewares.
    * @param action - The context (READ, CREATE, UPDATE, DELETE).
    * @param timing - Whether to run the `before` or `after` pipeline.
    * @param params - Optional parameters passed down to the middlewares.
    * @returns A promise resolving to the potentially mutated DataObject.
    */
   async executeMiddlewares(
      dataObject: DataObjectClass<any>,
      action: BackendAction,
      timing: 'before' | 'after' = 'before',
      params?: MiddlewareParams
   ) {
      for (const middleware of this._middlewares) {
         if (timing === 'before') {
            if (middleware.beforeExecute) {
               await middleware.beforeExecute(dataObject, action, params)
            } else if (middleware.execute) {
               await middleware.execute(dataObject, action, params)
            }
         } else if (timing === 'after') {
            if (middleware.afterExecute) {
               await middleware.afterExecute(dataObject, action, params)
            }
         }
      }

      return dataObject
   }

   /**
    * Executes an aggregation operation (sum, avg, distinct, min, max, count) on a query.
    * The default implementation fetches all matching records and performs in-memory aggregation.
    * Specific database adapters should override this to perform native query aggregation.
    * 
    * @param query - The Query instance defining the collection and filters.
    * @param operation - The aggregate operation.
    * @param property - The name of the property to aggregate.
    * @returns A promise resolving to the aggregated result.
    */
   async aggregate(
      query: Query<any>,
      operation: 'sum' | 'avg' | 'distinct' | 'min' | 'max' | 'count',
      property?: string
   ): Promise<any> {
      const { items } = await this.query(query)

      if (operation === 'count') {
         return items.length
      }

      if (!property) {
         throw new BackendError(`Property name is required for aggregation operation '${operation}'`)
      }

      const values = items
         .map((item) => {
            const prop = item.get(property)
            return prop ? prop.val() : undefined
         })
         .filter((v) => v !== undefined)

      switch (operation) {
         case 'sum': {
            return values.reduce((acc, val) => {
               const num = Number(val)
               return acc + (Number.isNaN(num) ? 0 : num)
            }, 0)
         }
         case 'avg': {
            if (values.length === 0) return 0
            const total = values.reduce((acc, val) => {
               const num = Number(val)
               return acc + (Number.isNaN(num) ? 0 : num)
            }, 0)
            return total / values.length
         }
         case 'distinct': {
            return Array.from(new Set(values))
         }
         case 'min': {
            if (values.length === 0) return undefined
            let minVal: number | undefined = undefined
            values.forEach((val) => {
               const num = Number(val)
               if (!Number.isNaN(num)) {
                  if (minVal === undefined || num < minVal) {
                     minVal = num
                  }
               }
            })
            return minVal
         }
         case 'max': {
            if (values.length === 0) return undefined
            let maxVal: number | undefined = undefined
            values.forEach((val) => {
               const num = Number(val)
               if (!Number.isNaN(num)) {
                  if (maxVal === undefined || num > maxVal) {
                     maxVal = num
                  }
               }
            })
            return maxVal
         }
         default:
            throw new BackendError(`Unsupported aggregation operation: ${operation}`)
      }
   }

   /**
    * Executes a raw query on the backend.
    * Only supported by SQL adapters.
    */
   async rawQuery(sql: string, params?: any[]): Promise<any> {
      throw new BackendError(`Raw queries are not supported on this adapter`)
   }

   /**
    * Generates the SQL up and down statements to create a collection table.
    */
   abstract generateCreateSql(collection: string, properties: any[]): { upSql: string, downSql: string }

   /**
    * Generates the SQL up and down statements to apply a schema delta to a collection.
    */
   abstract generateDeltaSql(collection: string, delta: SchemaDelta): { upSql: string[], downSql: string[] }

   /**
    * Resolves the canonical database path for a record, respecting standard collection structures
    * and hierarchical subcollection configurations.
    */
   protected _buildPath(dataObject: DataObjectClass<any>, uid?: string) {
      const collection = this.getCollection(dataObject)
      if (!collection) {
         throw new BackendError(
            `[${this.constructor.name}] Can't define record path without a collection name`
         )
      }

      // define document path
      let path = `${collection}/${uid}`
      if (
         this._params.hierarchy &&
         this._params.hierarchy[collection] ===
            CollectionHierarchy.SUBCOLLECTION &&
         dataObject.parentProp &&
         dataObject.has(dataObject.parentProp) &&
         dataObject.val(dataObject.parentProp)
      ) {
         path = `${dataObject.val(dataObject.parentProp).path}/${path}`
      }

      Backend.debug(`[${this.constructor.name}] Record path is '${path}'`)

      return path
   }

   /**
    * Processes raw data entries to convert relational reference objects into native database foreign key IDs
    * if the adapter has been configured with `useNativeForeignKeys = true`.
    */
   protected _resolveNativeForeignKeys(data: any[]): any[] {
      if (
         this._params['useNativeForeignKeys'] &&
         this._params['useNativeForeignKeys'] === true
      ) {
         data.forEach((el: any, key: number) => {
            if (
               typeof el === 'object' &&
               el !== null &&
               Reflect.has(el, 'ref')
            ) {
               const resourcePart = el.ref.split('/').pop()
               if (resourcePart.indexOf('.') === -1) {
                  data[key] = el.ref.split('/').pop()
               }
            }
         })
      }
      return data
   }
}
