import { Property } from '../properties/Property'
import { PropertyClassType } from '../properties/types/PropertyClassType'
import { AbstractObject } from './AbstractObject'
import { ObjectUri } from './ObjectUri'
import { NotFoundError } from '../common/ResourcesErrors'
import { toJSONParams } from './types/toJSONParams'
import { BaseObject } from './BaseObject'
import { DataObjectType } from './types/DataObjectType'
import { DataObjectParams } from './types/DataObjectParams'

export type CoreObject<T extends AbstractObject> = T

export type Properties = { [x: string]: PropertyClassType }

export interface DataObjectFactoryType {
   path: string
   [x: string]: any
}

/**
 * Data objects constitute the agnostic glue between objects and backends.
 * They handle data and identifiers in a protected registry
 * This is what backends and objects manipulate, oblivious of the other.
 */
export class DataObject implements DataObjectType {
   protected _objectUri: ObjectUri
   protected _uid: string | undefined = undefined
   protected _properties: Properties = {}
   protected _populated: boolean = false
   protected _parentProp: string | undefined

   protected _proxied: any

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
         this._parentProp = params.parentProp
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

   /**
    * Wrap instance into proxy to get access to properties
    * @returns Proxy
    */
   public asProxy() {
      return new Proxy(this, {
         get: (target, prop) => {
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

   public setProperties(properties: Properties) {
      // TODO check if doable
      this._properties = properties
   }

   /**
    * Return a map of all propoerties or only those matching the provided type
    * @param type
    * @returns
    */
   public getProperties(type?: string) {
      if (type) {
         const matches = {}
         for (let k of Object.keys(this._properties)) {
            if (this._properties[k].constructor.name === type) {
               Reflect.set(matches, k, this._properties[k])
            }
         }

         return matches
      }

      return this._properties
   }

   public addProperty(property: PropertyClassType) {
      if (Object.keys(this._properties).includes(property.name)) {
         throw new Error(`Property ${property.name} already exists`)
      }
      this._properties[property.name] = property
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
            // } else if (this.path !== '/' && this.path !== '') {
            //    await this.populateFromBackend()
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
                  !val.hasOwnProperty('bucket') &&
                  'ref' in val &&
                  typeof val.ref == 'string' &&
                  'label' in val &&
                  typeof val.label == 'string'
               ) {
                  const { ref, label } = val

                  Reflect.get(this._properties, key).set(
                     new ObjectUri(ref, label),
                     false
                  )
               } else {
                  Reflect.get(this._properties, key).set(data[key], false)
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

   isPopulated() {
      return this._populated
   }

   get properties(): Properties {
      return this._properties
   }

   // get backend() {
   //    return this._objectUri ? this._objectUri.backend : undefined
   // }

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
         //  this._persisted = true
      }
   }

   get uri(): ObjectUri {
      return this._objectUri
   }

   get class(): any {
      // TODO get class type
      return this.uri.class
   }

   get parentProp() {
      return this._parentProp
   }
   set parentProp(str) {
      this._parentProp = str
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
      if (!Reflect.has(this._properties, key)) {
         throw new NotFoundError(`No property matching key '${key}'`)
      }
      return Reflect.get(this._properties, key)
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
   val(key: string, transform: string | undefined = undefined) {
      if (this.has(key)) {
         return Reflect.get(this._properties, key).val(transform)
      } else {
         return undefined
      }
   }

   toJSON(params: boolean | toJSONParams = false): { [x: string]: any } {
      let objectsAsReferences: boolean = false,
         withoutURIData: boolean = false,
         ignoreUnchanged: boolean = false,
         ignoreNulls: boolean = false,
         converters: any = {}

      if (typeof params === 'object') {
         // Any missing parameter should resolve to false
         objectsAsReferences = Boolean(params.objectsAsReferences)
         withoutURIData = Boolean(params.withoutURIData)
         ignoreUnchanged = Boolean(params.ignoreUnchanged)
         ignoreNulls = Boolean(params.ignoreNulls)
         converters = params.converters
      }

      return {
         ...(!withoutURIData &&
            this.uri && { uid: this.uri.uid, path: this.uri.path }),
         ...this._dataToJSON(
            objectsAsReferences,
            ignoreUnchanged,
            ignoreNulls,
            converters
         ),
      }
   }

   toReference() {
      return {
         ...this._objectUri.toReference(),
         label: this.val('name') || '',
      }
   }

   protected _dataToJSON(
      objectsAsReferences = false,
      ignoreUnchanged = false,
      ignoreNulls = false,
      converters = {}
   ) {
      const data = {}
      Object.keys(this._properties).forEach((key: string) => {
         const prop = Reflect.get(this._properties, key)
         if (ignoreNulls && (prop.val() === null || prop.val() === undefined))
            return
         if (ignoreUnchanged && prop.hasChanged === false) return

         switch (prop.constructor.name) {
            case 'CollectionProperty':
               // ignore
               break
            case 'ObjectProperty':
               const value: BaseObject | ObjectUri | undefined = prop.val()
               Reflect.set(
                  data,
                  key,
                  value
                     ? objectsAsReferences && !(value instanceof ObjectUri)
                        ? value.asReference()
                        : value.toJSON
                        ? value.toJSON()
                        : value
                     : null
               )

               break

            case 'BooleanProperty':
               Reflect.set(data, key, Boolean(prop.val()))
               break

            case 'ArrayProperty':
               Reflect.set(data, key, prop.val() || [])
               break

            case 'DateTimeProperty':
               Reflect.set(
                  data,
                  key,
                  prop.val(Reflect.get(converters, 'datetime')) || null
               )
               break

            default:
               Reflect.set(data, key, prop.val() || null)
               break
         }
      })

      return data
   }

   // async read(): Promise<DataObjectClass<any>> {
   //    throw new Error(
   //       `This is just a stub, please use DataObject from @quatrain/backend to persist`
   //    )
   // }

   // save(): Promise<DataObjectClass<any>> {
   //    throw new Error(
   //       `This is just a stub, please use DataObject from @quatrain/backend to persist`
   //    )
   // }

   // async delete(): Promise<DataObjectClass<any>> {
   //    throw new Error(
   //       `This is just a stub, please use DataObject from @quatrain/backend to persist`
   //    )
   // }

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
