import {
   BaseObjectType,
   GoneError,
   NotFoundError,
   ObjectUri,
   statuses,
} from '@quatrain/core'
import { DataObjectClass } from './types/DataObjectClass'
import { PersistedDataObject } from './PersistedDataObject'
import { PersistedBaseObject } from './PersistedBaseObject'
import { Query, QueryResultType } from './Query'
import { BackendInterface } from './types/BackendInterface'
import { Backend } from './Backend'
import { ReferenceType } from './types/ReferenceType'
import { User } from './User'
import { BackendContext } from './BackendContext'

const RESOURCE_GONE_ERROR = `The resource you are trying to access has been deleted.`

/**
 * CRUD methods for models/entities inheriting from BaseObject
 * Extend this by passing the typeof of the desired class to the constructor
 */
export class BaseRepository<T extends BaseObjectType> {
   static get currentUser(): User | undefined {
      return BackendContext.getStore()?.user
   }

   static set currentUser(user: User | undefined) {
      const store = BackendContext.getStore()
      if (store) {
         store.user = user
      } else {
         Backend.warn("BaseRepository.currentUser setter called outside of BackendContext")
      }
   }

   /** Toggle indicating whether to automatically parse formats natively as Date. */
   static useDateFormat: boolean = true

   //implements RepositoryClass<T>
   protected _model: typeof PersistedBaseObject
   /** The specific backend adapter designated for this repository's requests. */
   backendAdapter: BackendInterface

   constructor(
      model: typeof PersistedBaseObject,
      backendAdapter: BackendInterface = Backend.getBackend()
   ) {
      this._model = model
      this.backendAdapter =
         backendAdapter && (typeof backendAdapter === 'function' || (backendAdapter as any).prototype instanceof PersistedBaseObject)
            ? Backend.getBackend()
            : backendAdapter
   }
   protected async getDataObjectFromUid(
      uid: string
   ): Promise<DataObjectClass<any>> {
      const collection =
         this._model.COLLECTION || this._model.name.toLowerCase()
      let path = `${collection}/${uid}`

      if (uid.split('/').length > 2) {
         path = uid
      }

      const dataObject = PersistedDataObject.factory({
         properties: this._model.PROPS_DEFINITION,
         uri: path,
      })

      dataObject.uid = uid

      return dataObject
   }



   protected async getDataObjectFromPath(
      path: string
   ): Promise<DataObjectClass<any>> {
      const dataObject = PersistedDataObject.factory({
         properties: this._model.PROPS_DEFINITION,
         uri: path,
      })

      dataObject.uid = path.substring(path.lastIndexOf('/') + 1)

      return dataObject
   }

   /**
    * Creates a new persistent record for the provided base object instance.
    * 
    * @param obj - The new model instance.
    * @param uid - Optional explicit identifier.
    * @returns A promise resolving to the saved and repopulated model instance.
    */
   async create<B extends PersistedBaseObject>(obj: B, uid?: string) {
      const savedObj = await this.backendAdapter.create(obj.dataObject, uid)
      return this._model.fromDataObject(savedObj)
   }

   /**
    * Internal utility transforming a string key or path into a ready-to-use DataObject.
    * 
    * @param key - The short UID or full database path.
    * @returns A promise resolving to the newly initialized DataObjectClass.
    * @throws {Error} If key is empty or malformed.
    */
   async getDataObject(key: string) {
      if (!key) {
         throw new Error(
            `Missing key value for getDataObject() in ${this.constructor.name}`
         )
      }
      let dataObject

      if (key.split('/').length <= 2) {
         const uid =
            key.indexOf('/') !== -1
               ? key.substring(key.lastIndexOf('/') + 1)
               : key
         dataObject = await this.getDataObjectFromUid(uid)
      } else {
         dataObject = await this.getDataObjectFromPath(key)
      }
      return dataObject
   }

   /**
    * Retrieve object from its backend
    * @param param string | ReferenceType
    * @returns {Promise<T | null>}
    */
   async read(param: string | ObjectUri | ReferenceType): Promise<any> {
      if (!param) {
         throw new Error(
            `Missing key value for read() in ${this.constructor.name}`
         )
      }

      let key

      if (param instanceof ObjectUri) {
         key = param.path
      } else if (typeof param === 'object') {
         key = param.ref
      } else {
         key = param
      }

      if (typeof key !== 'string') {
         throw new Error(
            `key value for read() must be a string, ${typeof key} value was passed`
         )
      }

      try {
         let dataObject = await this.getDataObject(key)

         const response = await this.backendAdapter.read(dataObject)

         const obj = this._model.fromDataObject(response)

         // TODO should be moved to the backend middleware
         if (obj.status === statuses.DELETED) {
            throw new GoneError(RESOURCE_GONE_ERROR)
         }

         return obj
      } catch (e) {
         Backend.error((e as Error).message)
         if (e instanceof GoneError) {
            throw e
         }

         if (e instanceof NotFoundError) {
            return null
         }

         throw e
      }
   }

   /**
    * Updates an existing database record using the mutated object instance.
    * 
    * @param obj - The modified object instance.
    * @returns A promise resolving to the updated object footprint.
    */
   async update<B extends PersistedBaseObject>(obj: B) {
      const dataObject = obj.dataObject || obj
      const savedObj = await this.backendAdapter.update(dataObject)

      return this._model.fromDataObject(savedObj)
   }

   /**
    * delete object in its backend
    * @param uid string
    */
   async delete(uid: string, hardDelete = false) {
      const dataObject = await this.getDataObject(uid)
      return await this.backendAdapter.delete(dataObject, hardDelete)
   }

   /**
    * Executes an advanced `Query` using the current repository's backend adapter.
    * 
    * @param query - The configured Query builder instance.
    * @returns A promise resolving to an array of model instances matching the query.
    */
   async query(query: Query<any>): Promise<QueryResultType<T>> {
      return await query.fetchAsInstances(this.backendAdapter)
   }
}

PersistedBaseObject.REPOSITORY_CLASS = BaseRepository
