import { Core } from '../Core'
import { DataObjectProperties } from '../properties'
import { Property } from '../properties/Property'
import { PropertyClassType } from '../properties/types/PropertyClassType'
import { AbstractObject } from './AbstractObject'
import { BaseObject } from './BaseObject'
import { Proxy } from './types/ProxyConstructor'
import { ObjectUri } from './ObjectUri'
import { DataObjectClass } from './types/DataObjectClass'
import { BaseObjectCore } from './BaseObjectCore'

export type CoreObject<T extends AbstractObject> = T
export type Properties = { [x: string]: PropertyClassType }

export interface DataObjectFactoryType {
   path: string
   [x: string]: any
}

export interface DataObjectParams {
   uri?: string | ObjectUri
   properties: DataObjectProperties
}

/**
 * Data objects constitute the agnostic glue between objects and backends.
 * They handle data and identifiers in a protected registry
 * This is what backends and objects manipulate, oblivious of the other.
 */
export class DataObject implements DataObjectClass<any> {
   protected _objectUri: ObjectUri
   protected _uid: string | undefined = undefined
   protected _properties: Properties = {}
   protected _persisted: boolean = false
   protected _populated: boolean = false

   /**
    * Has data been modified since last backend operation?
    */
   protected _modified: boolean = false

   /**
    * Constructor is protected, use factory() instead
    * @param params object of parameters
    */
   protected constructor(params: DataObjectParams | undefined) {
      if (params) {
         if (typeof params.uri !== 'object') {
            this._objectUri = new ObjectUri(params.uri)
         } else {
            this._objectUri = params.uri
         }
      } else {
         this._objectUri = new ObjectUri()
      }

      if (params && Array.isArray(params.properties)) {
         this._init(params.properties)
      }
   }

   protected _init(properties: any[]) {
      properties.forEach((prop) => {
         this._properties[prop.name] = Property.factory(prop, this)
      })
   }

   public setProperties(properties: Properties) {
      // TODO check if doable
      this._properties = properties
   }

   /**
    * Populate data object from instant data or backend query
    * @param data
    */
   async populate(
      data: { name: string; [x: string]: unknown } | undefined = undefined
   ): Promise<DataObject> {
      if (this._populated === false) {
         if (data) {
            this.populateFromData(data)
         } else if (this.path !== '/' && this.path !== '') {
            await this.populateFromBackend()
         }
         this._populated = true

         if (Reflect.get(this._properties, 'name')) {
            this.uri.label = this.val('name')
         }
      }

      return this
   }

   /**
    * Populate data object from instant data or backend query
    * @param data
    */
   populateFromData(data: { [x: string]: unknown }): this {
      if (this._populated === false) {
         for (const key in data) {
            if (Reflect.get(this._properties, key)) {
               const val = data[key]
               if (
                  val &&
                  typeof val === 'object' &&
                  'ref' in val &&
                  typeof val.ref == 'string' &&
                  'label' in val &&
                  typeof val.label == 'string'
               ) {
                  const { ref, label } = val
                  Reflect.get(this._properties, key).set(
                     new ObjectUri(ref, label)
                  )
               } else {
                  Reflect.get(this._properties, key).set(data[key])
               }
            }
         }

         this._populated = true

         if (Reflect.get(this._properties, 'name')) {
            this.uri.label = this.val('name')
         }
      }

      return this
   }

   /**
    * Populate data object from backend query
    * @param data
    */
   async populateFromBackend(): Promise<DataObject> {
      if (this._populated === false) {
         if (this.path !== '/' && this.path !== '') {
            await Core.getBackend(this._objectUri.backend).read(this)
         }
         this._populated = true

         if (Reflect.get(this._properties, 'name')) {
            this.uri.label = this.val('name')
         }
      }

      return this
   }

   isPopulated() {
      return this._populated
   }

   isPersisted() {
      return this._persisted
   }

   get properties() {
      return this._properties
   }

   get backend() {
      return this._objectUri ? this._objectUri.backend : undefined
   }

   get path() {
      return this._objectUri ? this._objectUri.path : ''
   }

   set uid(uid: string | undefined) {
      if (this._uid !== undefined) {
         throw new Error(`DataObject already has an uid`)
      }
      this._uid = uid
   }

   get uid(): string | undefined {
      return this._objectUri ? this._objectUri.uid : undefined
   }

   get data(): any {
      return this._properties
   }

   set uri(uri: ObjectUri) {
      this._objectUri = uri
      if (this._objectUri.collection !== ObjectUri.MISSING_COLLECTION) {
         this._persisted = true
      }
   }

   get uri(): ObjectUri {
      return this._objectUri
   }

   get class(): any {
      // TODO get class type
      return this.uri.class
   }

   has(key: string) {
      return Reflect.has(this._properties, key)
   }

   /**
    * Returns property matching key or throw
    * @param key string
    * @returns BaseProperty
    */
   get(key: string) {
      try {
         return this._properties[key]
      } catch (err) {
         throw new Error((err as Error).message)
      }
   }

   set(key: string, val: any) {
      if (!this.has(key)) {
         throw new Error(`Unknown property in data object: ${key}`)
      }
      this._properties[key].set(val)
      this._populated = true
      this._modified = true

      return this
   }

   /**
    * Get value of given property
    * @param key string
    * @returns any
    */
   val(key: string) {
      if (this.has(key)) {
         return Reflect.get(this._properties, key).val()
      } else {
         throw new Error(`Unknown property '${key}'`)
      }
   }

   toJSON(objectsAsReferences = false): { [x: string]: any } {
      return {
         ...(this._uid && { uid: this._uid }),
         ...this._dataToJSON(objectsAsReferences),
      }
   }

   toReference() {
      return {
         ...this._objectUri.toReference(),
         label: this.val('name') || '',
      }
   }

   protected _dataToJSON(objectsAsReferences = false) {
      const data = {}
      Object.keys(this._properties).forEach((key: string) => {
         const prop: any = Reflect.get(this._properties, key)
         switch (prop.constructor.name) {
            case 'CollectionProperty':
               // ignore
               break
            case 'ObjectProperty':
               const value: Proxy<BaseObject> | ObjectUri | undefined =
                  prop.val()
               Reflect.set(
                  data,
                  key,
                  value
                     ? objectsAsReferences && !(value instanceof ObjectUri)
                        ? value.core.asReference() //toReference()
                        : value.toJSON()
                     : null
               )

               break

            default:
               Reflect.set(data, key, prop.val() || null)
         }
      })

      return data
   }

   async read(): Promise<DataObjectClass<any>> {
      try {
         return await Core.getBackend().read(this) //this.populate()
      } catch (err) {
         console.log((err as Error).message)
         throw new Error((err as Error).message)
      }
   }

   save(): Promise<DataObjectClass<any>> {
      const backend = Core.getBackend(this.backend || Core.defaultBackend)
      this._persisted = true
      this._modified = false

      return this.uid ? backend.update(this) : backend.create(this)
   }

   async delete(): Promise<DataObjectClass<any>> {
      const backend = Core.getBackend(this.backend || Core.defaultBackend)
      this._persisted = false
      this._modified = false

      return await backend.delete(this)
   }

   /**
    * Data object must be created from factory in order for async-loaded data to be available
    * @param className
    * @param param
    * @returns DataObject
    */
   static factory(param: DataObjectParams | undefined = undefined): DataObject {
      try {
         return new this(param)
      } catch (err) {
         console.log(err)
         throw new Error(
            `Unable to build data object: ${(err as Error).message}`
         )
      }
   }

   async clone(data: any = {}): Promise<DataObject> {
      const cloned = await DataObject.factory()
      cloned.uri.class = this.uri.class
      cloned._populated = false

      for (let property of Object.keys(this._properties)) {
         cloned._properties[property] = this._properties[property].clone()
      }

      if (data) {
         await cloned.populate(data)
      }

      return cloned
   }
}
