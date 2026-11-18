import { DataObjectClass } from './types/DataObjectClass'
import { DataObjectProperties } from '../properties'

/**
 * Foundational wrapper for interacting with properties dynamically.
 */
export abstract class AbstractObject {
   /** Array defining the structure and constraints of properties belonging to this model. */
   static PROPS_DEFINITION: DataObjectProperties = []

   /** The backend identifier (table or collection name) representing this class. */
   static COLLECTION: string | undefined

   /** The name of the property handling hierarchical parent relationships. */
   static PARENT_PROP: string | undefined

   /**
    * Which property's value to use in backend as label for object reference
    */
   static LABEL_KEY = 'name'

   protected _dataObject: DataObjectClass<any>

   constructor(dao: DataObjectClass<any>) {
      this._dataObject = dao
   }

   /**
    * Return property object matching key
    * @param key string
    * @returns
    */
   get(key: string) {
      return this._dataObject.get(key)
   }

   /**
    * Proxies a set command to the underlying data object.
    * 
    * @param key - The property key.
    * @param val - The value to assign.
    * @returns The DataObject instance for chaining.
    */
   set(key: string, val: any) {
      return this._dataObject.set(key, val)
   }

   /**
    * Fetches the value of a property.
    * 
    * @param key - The property key.
    * @returns The property value or null if undefined.
    */
   val(key: string): any {
      const prop = this.get(key)
      if (prop) {
         return prop.val()
      } else {
         return null
      }
   }

   /**
    * Checks if a property exists on the data object.
    * 
    * @param key - The property key.
    * @returns True if the property exists.
    */
   has(key: string) {
      return Reflect.has(this._dataObject.properties, key)
   }

   get path(): string {
      return this._dataObject.path
   }

   get uid() {
      return this._dataObject.uid
   }

   get dataObject() {
      return this._dataObject
   }

   get _() {
      return this._dataObject.asProxy()
   }

   get uri() {
      return this._dataObject.uri
   }

   /**
    * Serializes the current object path / identity.
    * 
    * @returns The JSON serialized ObjectUri.
    */
   toJSON() {
      return typeof this.uri === 'string' ? this.uri : this.uri?.toJSON()
   }

   /**
    * Serializes the current object path / identity for MessagePack payloads.
    *
    * @returns The MessagePack serialized ObjectUri (`{ path, label }`).
    */
   toMsgPack() {
      return typeof this.uri === 'string' ? this.uri : this.uri?.toMsgPack()
   }
}
