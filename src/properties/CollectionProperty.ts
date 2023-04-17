import { BaseProperty, BasePropertyType } from './BaseProperty'
import { Query, Filter } from '../backends'
import { BaseObject, DataObject, ObjectUri } from '../components'
import { Core } from '../Core'
import { returnAs } from '../backends/Query'

export interface CollectionPropertyType<T extends typeof BaseObject>
   extends BasePropertyType {
   instanceOf: T
   backend?: string
}

export class CollectionProperty<
   T extends typeof BaseObject,
> extends BaseProperty {
   static TYPE = 'collection'
   protected _value: Array<T> | Array<DataObject> | Array<ObjectUri> | undefined = undefined
   protected _instanceOf: T
   protected _backend: undefined
   protected _query: Query<any> | undefined = undefined
   protected _filters: Filter[] | Filter | undefined = undefined

   constructor(config: CollectionPropertyType<T>) {
      super(config)
      this._instanceOf = config.instanceOf
      this._backend = config.backend
         ? Core.getBackend(config.backend)
         : undefined
   }

   set(value: Array<any>) {
      return super.set(value)
   }

   /**
    * get objects matching collection class and filters
    * in the requested format
    * @param filters
    * @returns
    */
   async get(
      filters: Filter[] | undefined = undefined,
      format: returnAs = returnAs.AS_DATAOBJECTS
   ): Promise<Array<T> | Array<DataObject> | Array<ObjectUri>>  {
      return this._value && this._filters === filters
         ? this._value
         : this._find(filters, format)
   }

   toJSON() {
      return this._value
   }

   protected async _find(
      filters: Filter[] | undefined = undefined,
      format: returnAs = returnAs.AS_DATAOBJECTS
   ): Promise<Array<any>> {
      this._query = new Query(this._instanceOf)
      if (filters) {
         this._query.filters = filters
      }

      return await this._query.execute(format, this._backend)
   }
}
