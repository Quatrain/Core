import {
   ObjectUri,
   BaseObjectProperties,
   BaseObject,
   BaseObjectType,
   statuses,
} from '@quatrain/core'
import { Query } from './Query'
import { DataObjectClass } from './types/DataObjectClass'
import { PersistedDataObject } from './PersistedDataObject'

export class PersistedBaseObject extends BaseObject {
   static PROPS_DEFINITION: any /*DataObjectProperties*/ = BaseObjectProperties

   protected _dataObject: DataObjectClass<any>

   constructor(dao: DataObjectClass<any>) {
      super(dao)
      this._dataObject = dao
   }

   static getProperty(key: string) {
      return PersistedBaseObject.PROPS_DEFINITION.find(
         (prop: any) => prop.name === key
      )
   }

   static fillProperties(child: any = this) {
      // merge base properties with additional or redefined ones
      const base = [...PersistedBaseObject.PROPS_DEFINITION]

      child.PROPS_DEFINITION.forEach((property: any) => {
         // manage parent properties potential redeclaration
         const found = base.findIndex((el: any) => el.name === property.name)
         if (found !== -1) {
            base[found] = property
         } else {
            base.push(property)
         }
      })

      const dao = PersistedDataObject.factory({
         properties: base,
         parentProp: this.PARENT_PROP,
      })
      dao.uri.class = child

      return dao
   }

   static async daoFactory(
      src: string | ObjectUri | DataObjectClass<any> | undefined = undefined,
      child: any = this
   ): Promise<DataObjectClass<any>> {
      const dao = this.fillProperties(child)

      if (src instanceof ObjectUri) {
         dao.uri = src
         await dao.read()
      } else if (typeof src == 'string') {
         dao.uri.path = src
         await dao.read()
      }

      return dao
   }

   /**
    * Instantiates from an object
    * @param src
    * @param child
    * @returns
    */
   static fromObject<T extends BaseObjectType>(src: T, child: any = this): any {
      const dao = this.fillProperties(child)

      dao.uri = new ObjectUri(
         `${this.COLLECTION}${ObjectUri.DEFAULT}`,
         Reflect.get(src, 'name')
      )

      dao.uri.class = child

      dao.populateFromData(src as any)

      if (dao.has('status') && dao.val('status') === undefined) {
         dao.set('status', statuses.CREATED)
      }

      const obj = new this(dao)

      return obj
   }

   static async factory(
      src: string | ObjectUri | undefined = undefined,
      child: any = this
   ): Promise<any> {
      try {
         if (typeof src == 'object' && !(src instanceof ObjectUri)) {
            return this.fromObject(src)
         }

         const dao = await this.daoFactory(src, child)

         if (!src && dao.has('status') && dao.val('status') === undefined) {
            dao.set('status', statuses.CREATED)
         }

         const constructedObject = Reflect.construct(this, [dao])

         return constructedObject
      } catch (err) {
         throw new Error(
            `Unable to build instance for '${this.name}': ${
               (err as Error).message
            }`
         )
      }
   }

   /**
    * Fetches an object from its backend path
    * @param path
    * @returns
    */
   static async fromBackend<T>(path: string): Promise<T> {
      if (!path.includes('/')) {
         return this.factory(`${this.COLLECTION}/${path}`)
      }
      return this.factory(path)
   }

   /**
    * Instantiates from a DataObject
    * @param dao
    * @returns
    */
   static fromDataObject<T extends BaseObject>(dao: DataObjectClass<any>): any {
      const obj = new this(dao)

      return obj //.toProxy()
   }

   asReference() {
      return this._dataObject.toReference()
   }

   /**
    * Create a query based on given class where parent is current instance
    * @param obj
    * @returns Query
    */
   query(obj: any) {
      return new Query(obj, this)
   }

   /**
    * Create a query based on current class
    * @returns Query
    */
   static query() {
      return new Query(this)
   }

   get dataObject() {
      return this._dataObject
   }

   async save(): Promise<this> {
      await this._dataObject.save()
      return this
   }

   async delete(): Promise<DataObjectClass<any>> {
      return await this._dataObject.delete()
   }
}
