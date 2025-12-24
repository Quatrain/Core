import { ObjectUri } from './ObjectUri'
import { DataObjectClass } from './types/DataObjectClass'
import { DataObject } from './DataObject'
import { BaseObjectType } from './types/BaseObjectType'
import { BaseObjectProperties } from './BaseObjectProperties'
import { AbstractObject } from './AbstractObject'
import { DataObjectType } from './types/DataObjectType'

export class BaseObject extends AbstractObject {
   // implements BaseObjectClass {
   static PROPS_DEFINITION: any /*DataObjectProperties*/ = BaseObjectProperties

   static getProperty(key: string) {
      return BaseObject.PROPS_DEFINITION.find((prop: any) => prop.name === key)
   }

   static fillProperties(child: any = this) {
      // merge base properties with additional or redefined ones
      const base = [...BaseObject.PROPS_DEFINITION]

      child.PROPS_DEFINITION.forEach((property: any) => {
         // manage parent properties potential redeclaration
         const found = base.findIndex((el: any) => el.name === property.name)
         if (found !== -1) {
            base[found] = property
         } else {
            base.push(property)
         }
      })

      const dao = DataObject.factory({
         properties: base,
         parentProp: this.PARENT_PROP,
      })
      dao.uri.class = child

      return dao
   }

   static async daoFactory(
      src: string | ObjectUri | DataObjectType | undefined = undefined,
      child: any = this
   ): Promise<DataObjectType> {
      const dao = this.fillProperties(child)

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

      const obj = new this(dao)

      return obj
   }

   static async factory(
      src: string | ObjectUri | BaseObjectType | undefined = undefined,
      child: any = this
   ): Promise<any> {
      try {
         if (typeof src == 'object' && !(src instanceof ObjectUri)) {
            return this.fromObject(src)
         }

         const dao = await this.daoFactory(src, child)

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
   static fromDataObject<T extends BaseObjectType>(
      dao: DataObjectClass<any>
   ): any {
      const obj = new this(dao)

      return obj //.toProxy()
   }

   asReference() {
      return this._dataObject.toReference()
   }
}
