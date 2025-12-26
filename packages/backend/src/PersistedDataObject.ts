import { DataObject as CoreDO, ObjectUri } from '@quatrain/core'
import { PersistedBaseObject } from './PersistedBaseObject'
import { Backend } from './Backend'
import { DataObjectClass } from './types/DataObjectClass'
import { DataObjectParams } from '@quatrain/core'
import { Persisted } from './types/Persisted'

/**
 * Data objects constitute the agnostic glue between objects and backends.
 * They handle data and identifiers in a protected registry
 * This is what backends and objects manipulate, oblivious of the other.
 */
export class PersistedDataObject extends CoreDO implements Persisted {
   protected _proxied: any

   protected _persisted: boolean = false

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
    * Populate data object from instant data or backend query
    * @param data
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
    * Populate data object from backend query
    * @param data
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
               const value: PersistedBaseObject | ObjectUri | undefined =
                  prop.val()
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

   has(key: string) {
      return Reflect.has(this._properties, key)
   }

   async read(): Promise<DataObjectClass<any>> {
      try {
         return await Backend.getBackend().read(this)
      } catch (err) {
         console.log((err as Error).message)
         throw new Error((err as Error).message)
      }
   }

   async save(): Promise<DataObjectClass<any>> {
      const backend = Backend.getBackend(this.backend || Backend.defaultBackend)
      this._persisted = true
      this._modified = false

      return this.uid ? backend.update(this) : backend.create(this)
   }

   async delete(): Promise<DataObjectClass<any>> {
      const backend = Backend.getBackend(this.backend || Backend.defaultBackend)
      this._persisted = false
      this._modified = false

      return await backend.delete(this)
   }
}
