import {
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

interface BM extends BackendMiddleware {}

export abstract class AbstractBackendAdapter implements BackendInterface {
   static PKEY_IDENTIFIER: any = 'id'

   protected _alias: string = ''
   protected _params: BackendParameters = {}
   protected _middlewares: BM[] = []

   constructor(params: BackendParameters = {}) {
      this._alias = params.alias || ''
      this._middlewares = params.middlewares || []
      this._params = params
   }

   setParam(key: BackendParametersKeys, value: any) {
      this._params[key] = value
   }

   getParam(key: BackendParametersKeys) {
      return this._params[key]
   }

   addMiddleware(middleware: BM) {
      if (this.hasMiddleware(middleware.constructor.name)) {
         throw new BackendError(
            `Middleware '${middleware.constructor.name}' is already attached`
         )
      }
      this._middlewares.push(middleware)
   }

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

   getCollection(dao: DataObjectClass<any>) {
      return dao.uri.collection
   }

   abstract create(
      dataObject: DataObjectClass<any>,
      desiredUid?: string | undefined
   ): Promise<DataObjectClass<any>>

   abstract read(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>>

   abstract update(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>>

   abstract delete(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>>

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

   abstract find(
      dataObject: DataObjectClass<any>,
      filters: Filters | Filter[] | undefined,
      pagination: SortAndLimit | undefined,
      parent: any
   ): Promise<QueryResultType<any>>

   log(message: string) {
      if (this._params['debug'] === true) {
         console.log(message)
      }
   }

   async executeMiddlewares(
      dataObject: DataObjectClass<any>,
      action: BackendAction,
      params?: MiddlewareParams
   ) {
      for (const middleware of this._middlewares) {
         await middleware.execute(dataObject, action, params)
      }

      return dataObject
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
}
