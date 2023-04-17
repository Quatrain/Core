import { DataObject } from './DataObject'
import { DataObjectClass } from './types/DataObjectClass'
import { ObjectUri } from './ObjectUri'
import { AbstractObject } from './AbstractObject'
import { BaseObjectProperties } from './BaseObjectProperties'
//import { DataObjectProperties } from '../properties'
import { Query } from '../backends/Query'
import { BaseObjectClass } from './types/BaseObjectClass'
import { Status } from '../common/statuses'

export class BaseObject extends AbstractObject implements BaseObjectClass {
   static PROPS_DEFINITION: any = BaseObjectProperties

   static getProperty(key: string) {
      return BaseObject.PROPS_DEFINITION.find((prop: any) => prop.name === key)
   }

   get name() {
      return this._dataObject.val('name')
   }

   set name(name: string) {
      this._dataObject.set('name', name)
   }

   get status(): Status {
      return this._dataObject.val('status')
   }

   set status(status: Status) {
      this._dataObject.set('status', status)
   }

   static async factory<T extends BaseObject>(
      src: string | ObjectUri | DataObjectClass | undefined = undefined,
      child: any = this
   ): Promise<T | BaseObject> {
      try {
         // merge base properties with additional or redefined ones
         const base = BaseObjectProperties

         // this.PROPS_DEFINITION &&
         this.PROPS_DEFINITION.forEach((property: any) => {
            // manage parent properties potential redeclaration
            const found = base.findIndex((el: any) => el.name === property.name)
            if (found !== -1) {
               base[found] = Object.assign(base[found], property)
            } else {
               base.push(property)
            }
         })

         // create data object
         const dao = await DataObject.factory({ properties: base })
         dao.uri.class = child

         if (src instanceof ObjectUri) {
            dao.uri = src
            await dao.read()
         } else if (typeof src === 'string') {
            dao.uri.path = src
            await dao.read()
         } else if (src instanceof Object) {
            dao.uri = new ObjectUri(
               `${this.COLLECTION}${ObjectUri.DEFAULT}`,
               Reflect.get(src, 'name')
            )
            dao.uri.collection = this.COLLECTION
            await dao.populate(src)
         }

         return Reflect.construct(this, [dao])
      } catch (err) {
         console.log((err as Error).message)
         throw new Error(
            `Unable to build instance for '${this.constructor.name}': ${
               (err as Error).message
            }`
         )
      }
   }

   asReference() {
      return this._dataObject.toReference()
   }

   query() {
      return new Query(this)
   }
}
