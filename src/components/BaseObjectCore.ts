import { ObjectUri } from './ObjectUri'
import { DataObjectClass } from './types/DataObjectClass'
import { BaseObjectClass } from './types/BaseObjectClass'
import { AbstractObject } from './AbstractObject'
import { BaseObjectProperties, BaseObject } from './BaseObject'
import { Query } from '../backends/Query'
import { DataObject } from './DataObject'
import { Persisted } from './types/Persisted'
import { ProxyConstructor, Proxy } from './types/ProxyConstructor'
import { DataObjectProperties } from '../properties'

export class BaseObjectCore extends AbstractObject implements BaseObjectClass {
   static PROPS_DEFINITION: DataObjectProperties = BaseObjectProperties

   static getProperty(key: string) {
      return BaseObjectCore.PROPS_DEFINITION.find(
         (prop: any) => prop.name === key
      )
   }

   static fillProperties(child: any = this) {
      // merge base properties with additional or redefined ones
      const base = [...BaseObjectCore.PROPS_DEFINITION]

      child.PROPS_DEFINITION.forEach((property: any) => {
         // manage parent properties potential redeclaration
         const found = base.findIndex((el: any) => el.name === property.name)
         if (found !== -1) {
            base[found] = property
         } else {
            base.push(property)
         }
      })

      const dao = DataObject.factory({ properties: base })
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
   static fromObject<T extends BaseObject>(
      src: T,
      child: any = this
   ): Proxy<T> {
      const dao = this.fillProperties(child)

      dao.uri = new ObjectUri(
         `${this.COLLECTION}${ObjectUri.DEFAULT}`,
         Reflect.get(src, 'name')
      )

      dao.uri.class = child

      dao.populateFromData(src as any)

      const obj = new this(dao)

      return obj.toProxy() as Proxy<T>
   }

   static async factory(
      src: string | ObjectUri | BaseObject | undefined = undefined,
      child: any = this
   ): Promise<any> {
      try {
         if (typeof src == 'object' && !(src instanceof ObjectUri)) {
            return this.fromObject(src)
         }

         const dao = await this.daoFactory(src, child)

         const constructedObject = Reflect.construct(this, [dao])

         return constructedObject.toProxy()
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
   static async fromBackend<T>(path: string): Promise<Persisted<T>> {
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
   static fromDataObject<T extends BaseObject>(dao: DataObjectClass<any>): T {
      const obj = new this(dao)

      return obj.toProxy()
   }

   protected toProxy<T extends BaseObject>() {
      return new ProxyConstructor<this, Proxy<T>>(this, {
         get: (target, prop) => {
            if (prop === 'uid') {
               return target.uid
            }

            if (prop === 'uri') {
               return target.uri
            }

            if (prop == 'toJSON') {
               return target.toJSON
            }

            if (prop == 'save') {
               return target.save
            }

            if (prop == 'constructor') {
               return target.constructor
            }

            if (prop === 'core') {
               return target
            }

            // i don't know why and i shouldn't have to wonder why
            // but everything crashes unless we do this terribleness
            if (prop == 'then') {
               return
            }

            return target.val(prop as string)
         },
         set(target, prop, newValue) {
            if (prop === 'uid' || prop === 'core') {
               throw new Error(`Property '${prop}' is readonly`)
            }

            target.set(prop as string, newValue)
            return true
         },
      })
   }

   asReference() {
      return this._dataObject.toReference()
   }

   query() {
      return new Query(this.constructor.prototype)
   }

   static query() {
      return new Query(this)
   }
}
