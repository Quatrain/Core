import { BaseObject, DataObjectClass, DataObjectType } from '../components'
import { Filter } from './Filter'
import { Filters } from './Filters'
import { Query } from './Query'
import { SortAndLimit } from './SortAndLimit'

/**
 * Default interface for a backend record
 */
export interface BackendRecordType {
   uid: string | undefined
   [key: string]: string | number | boolean | any[] | Object | undefined
}

/**
 * Backend Parameters acceptable keys
 */
export type BackendParametersKeys =
   | 'alias'
   | 'mapping'
   | 'injectMeta'
   | 'config'
   | 'fixtures'
   | 'softDelete'
   | 'debug'

/**
 * Backend parameters interface
 */
export interface BackendParameters {
   alias?: string
   mapping?: { [x: string]: any }
   injectMeta?: boolean
   config?: any
   fixtures?: any
   softDelete?: boolean
   debug?: boolean
}

export interface BackendInterface<T extends BaseObject> {
   create(
      dataObject: DataObjectClass,
      desiredUid: string | undefined
   ): Promise<DataObjectClass>

   read(param: string | DataObjectClass): Promise<DataObjectClass>

   update(dataObject: DataObjectClass): Promise<DataObjectClass>

   delete(dataObject: DataObjectClass): Promise<DataObjectClass>

   query(query: Query<any>): Promise<DataObjectClass[]>

   find(
      dataObject: DataObjectClass,
      filters: Filters | Filter[] | undefined,
      pagination: SortAndLimit | undefined
   ): Promise<DataObjectClass[] | T[]>
}

export abstract class AbstractAdapter {
   protected _alias: string = ''
   protected _params: BackendParameters = {}
   protected _injectMeta: boolean = false

   constructor(params: BackendParameters) {
      this._alias = params.alias || ''
      this._injectMeta = params.injectMeta || false
   }

   setParam(key: BackendParametersKeys, value: any) {
      this._params[key] = value
   }

   getParam(key: BackendParametersKeys) {
      return this._params[key]
   }

   set alias(alias: string) {
      this._alias = alias
   }

   get alias() {
      return this._alias
   }

   log(message: string) {
      if (this._params['debug'] === true) {
         console.log(message)
      }
   }
}
