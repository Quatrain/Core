import { DataObject as CoreDO, Property } from '@quatrain/core'
import type { PersistedBaseObject } from './PersistedBaseObject'
import { Backend } from './Backend'
import { DataObjectClass } from './types/DataObjectClass'
import { DataObjectParams } from '@quatrain/core'
import { Persisted } from './types/Persisted'
import { CollectionProperty } from './CollectionProperty'

/**
 * Data objects constitute the agnostic glue between objects and backends.
 * They handle data and identifiers in a protected registry.
 * This is what backends and objects manipulate, oblivious of the other.
 * It manages the actual "dirty" state, paths, and values mapped from the database.
 */
export class PersistedDataObject extends CoreDO implements Persisted {
   protected declare _proxied: any

   protected _persisted: boolean = false

   protected _init(properties: any[]) {
      properties.forEach((prop) => {
         if (prop.type === CollectionProperty.TYPE) {
            prop.parent = this
            this._properties[prop.name] = new CollectionProperty(prop)
         } else {
            this._properties[prop.name] = Property.factory(prop, this)
         }
      })
   }

   /**
    * Checks or updates the persisted state of the DataObject.
    * 
    * @param set - If true, flags the object as fully saved and resets property modification trackers.
    * @returns True if the object was explicitly persisted.
    */
   isPersisted(set = false) {
      if (set === true) {
         // Reset all properties 'hasChanged' flags, typically after object was saved
         Object.keys(this.properties).forEach((key) => {
            Reflect.set(this.properties[key], 'hasChanged', false)
         })
         this._persisted = true
      }

      return this._persisted
   }

   /**
    * Populates the internal properties with given data or triggers a backend fetch
    * if the object possesses a path but hasn't been loaded yet.
    * 
    * @param data - Optional predefined data dictionary to hydrate immediately.
    * @returns A promise resolving to the hydrated data object.
    */
   async populate(
      data: { name: string; [x: string]: unknown } | undefined = undefined
   ): Promise<PersistedDataObject> {
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
    * Forces a read operation from the configured backend adapter using the current URI path,
    * populating internal properties with the retrieved database values.
    * 
    * @returns A promise resolving to the populated data object.
    */
   async populateFromBackend(): Promise<PersistedDataObject> {
      if (this._populated === false) {
         if (this.path !== '/' && this.path !== '') {
            await Backend.getBackend(this._objectUri.backend).read(this)
         }
         this._populated = true

         if (Reflect.get(this._properties, 'name')) {
            this.uri.label = this.val('name')
         }
      }

      return this
   }

   /**
    * Retrieves the specific backend alias bound to this object's URI.
    * 
    * @returns The string alias of the backend adapter (e.g., 'default', 'firestore').
    */
   get backend() {
      return this._objectUri ? this._objectUri.backend : undefined
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
         if (ignoreNulls && (prop.val() === null || prop.val() === undefined)) {
            return
         }
         if (ignoreUnchanged && prop.hasChanged === false) return

         switch (prop.constructor.name) {
            case 'CollectionProperty':
               // ignore
               break
            case 'ObjectProperty':
               const value: any = prop.val()
               Reflect.set(
                  data,
                  key,
                  value
                     ? objectsAsReferences &&
                       typeof value.asReference === 'function'
                        ? (value as PersistedBaseObject).asReference()
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

   /**
    * Data object must be created from factory in order for async-loaded data to be available
    * @param className
    * @param param
    * @returns DataObject
    */
   static factory(
      param: DataObjectParams | undefined = undefined
   ): PersistedDataObject {
      try {
         return new this(param)
      } catch (err) {
         console.log(err)
         throw new Error(
            `Unable to build data object: ${(err as Error).message}`
         )
      }
   }

   /**
    * Checks whether a specific property exists in the data object's definition.
    * 
    * @param key - The property name to verify.
    * @returns True if the property is defined, false otherwise.
    */
   has(key: string) {
      return Reflect.has(this._properties, key)
   }

   /**
    * Instructs the global backend adapter to read and return the raw data object state.
    * 
    * @returns A promise resolving to the fetched DataObjectClass.
    * @throws {Error} If the read operation fails at the adapter level.
    */
   async read(): Promise<DataObjectClass<any>> {
      try {
         return await Backend.getBackend().read(this)
      } catch (err) {
         console.log((err as Error).message)
         throw new Error((err as Error).message)
      }
   }

   /**
    * Pushes the current object state to the backend adapter.
    * Determines automatically whether an 'update' or 'create' operation is needed based on the UID.
    * 
    * @returns A promise resolving to the updated DataObjectClass.
    */
   async save(): Promise<DataObjectClass<any>> {
      const backend = Backend.getBackend(this.backend || Backend.defaultBackend)
      this._persisted = true
      this._modified = false

      return this.uid ? backend.update(this) : backend.create(this)
   }

   /**
    * Requests the backend adapter to delete the object from persistence.
    * The 'hardDelete' behavior is usually controlled by the parent `PersistedBaseObject`.
    * 
    * @returns A promise resolving upon successful deletion.
    */
   async delete(): Promise<DataObjectClass<any>> {
      const backend = Backend.getBackend(this.backend || Backend.defaultBackend)
      this._persisted = false
      this._modified = false

      return await backend.delete(this)
   }
}
