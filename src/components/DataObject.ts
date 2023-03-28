import { Core } from '../Core'
import { Property } from '../properties/Property'
import { AbstractObject } from './AbstractObject'
import { ObjectUri } from './ObjectUri'

export interface DataObjectFactoryType {
   path: string
   [x: string]: any
}

export type CoreObject<T extends AbstractObject> = T

/**
 * Data objects constitute the agnostic glue between objects and backends.
 * They handle data and identifiers in a protected registry
 * This is what backends and objects manipulate, oblivious of the other.
 */
export class DataObject {
   protected _class: CoreObject<any>
   protected _objectUri: ObjectUri
   protected _obj: any
   protected _uid: string | undefined = undefined
   protected _properties: { [x: string]: any } = {}
   protected _persisted: boolean = false
   protected _populated: boolean = false

   /**
    * Has data been modified since last backend operation?
    */
   protected _modified: boolean = false

   /**
    * Constructor is protected, use factory() instead
    * @param objClass AbstractObject
    * @param properties array of properties instances
    */
   protected constructor(
      objClass: typeof AbstractObject.prototype,
      properties: any[] | undefined
   ) {
      this._class = objClass
      this._objectUri = new ObjectUri()
      if (Array.isArray(properties)) {
         this._init(properties)
      }
   }

   protected _init(properties: any[]) {
      // console.log(
      //    `Preparing properties for instance of ${this._class.constructor.name}`
      // )
      properties.forEach((prop) => {
         this._properties[prop.name] = Property.factory(prop, this)
      })
   }

   /**
    * Populate data object from instant data or backend query
    * @param data
    */
   async populate(data: any = undefined): Promise<DataObject> {
      if (this._populated === false) {
         if (data) {
            for (const key in data) {
               if (Reflect.get(this._properties, key)) {
                  Reflect.get(this._properties, key).set(data[key])
               }
            }
         } else if (this.path !== '/' && this.path !== '') {
            await Core.getBackend(this._objectUri.backend).read(this)
         }
         this._populated = true

         if (Reflect.get(this._properties, 'name')) {
            this.uri.label = this.val('name')
         }
      }

      return this
   }

   /**
    * Returns a deep copy of the instance of DataObject
    * @returns
    */
   clone() {
      const serializedDataObject = JSON.stringify(this)

      const deserializedDataObject = JSON.parse(serializedDataObject)

      return deserializedDataObject
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

   get class() {
      return this._class
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

   set uri(uri: string | ObjectUri | undefined) {
      this._objectUri = uri instanceof ObjectUri ? uri : new ObjectUri(uri)
   }

   get uri(): ObjectUri {
      return this._objectUri
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
      if (!Reflect.has(this._properties, key)) {
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
      if (Reflect.get(this._properties, key)) {
         return Reflect.get(this._properties, key).val()
      } else {
         throw new Error(`Unknown property '${key}'`)
      }
   }

   toJSON(): { [x: string]: any } {
      return {
         ...(this._uid && { uid: this._uid }),
         ...this._dataToJSON(),
      }
   }

   toReference() {
      return {
         ...this._objectUri?.toReference(),
         label: this.val('name'),
      }
   }

   protected _dataToJSON() {
      const data = {}
      Object.keys(this._properties).forEach((key: string) => {
         const prop: any = Reflect.get(this._properties, key)
         if (
            typeof prop.val() === 'object' &&
            Reflect.has(prop.val(), 'toJSON')
         ) {
            Reflect.set(data, key, prop.val().toJSON())
         } else if (prop !== undefined) {
            Reflect.set(data, key, prop.val())
         }
      })

      return data
   }

   async read(): Promise<DataObject> {
      try {
         return this.populate(Core.getBackend().read(this))
      } catch (err) {
         console.log((err as Error).message)
         throw new Error((err as Error).message)
      }
   }

   async save(desiredUid: string | undefined = undefined): Promise<DataObject> {
      const backend = Core.getBackend(this.backend || Core.defaultBackend)
      this._persisted = true
      this._modified = false
      return this._uid
         ? await backend.update(this)
         : await backend.create(this, desiredUid)
   }

   /**
    * Data object must be created from factory in order for async-loaded data to be available
    * @param className
    * @param param
    * @returns DataObject
    */
   static async factory(
      className: typeof AbstractObject.prototype,
      param: any[] | undefined = undefined
   ): Promise<DataObject> {
      if (className === undefined) {
         throw new Error(`className is a require value`)
      }

      try {
         return new this(className, param)
      } catch (err) {
         throw new Error(
            `Unable to build data object: ${(err as Error).message}`
         )
      }
   }
}
