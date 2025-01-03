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

export class Query<T extends typeof PersistedBaseObject> {
   protected _obj: T
   protected _parent: T | undefined

   filters: Filter[]
   sortings: Sorting[]
   limits: Limits
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

   sortBy(param: Sorting | string, order: any = 'asc') {
      if (typeof param == 'object') {
         this.sortings.push(param)
      } else {
         this.sortings.push(new Sorting(param, order))
      }

      return this
   }

   setLimits(limits: Limits) {
      this.limits = limits
      return this
   }

   offset(offset: number = 0) {
      this.limits.offset = offset
      return this
   }

   batch(batch: number = 10) {
      this.limits.batch = batch
      return this
   }

   get sortAndLimit() {
      return new SortAndLimit(this.sortings, this.limits)
   }

   async fetch(
      backend: BackendInterface = Backend.getBackend()
   ): Promise<QueryResultType<DataObjectClass<any>>> {
      return backend.query(this)
   }

   async fetchAsUri(
      backend: BackendInterface = Backend.getBackend()
   ): Promise<QueryResultType<ObjectUri>> {
      const { items, meta } = await this.fetch(backend)

      return { items: await Promise.all(items.map((dao) => dao.uri)), meta }
   }

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
}
