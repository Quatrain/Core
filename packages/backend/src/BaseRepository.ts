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
import { Backend, BackendAction } from './Backend'
import { ReferenceType } from './types/ReferenceType'
import { User } from './User'

const RESOURCE_GONE_ERROR = `The resource you are trying to access has been deleted.`

/**
 * CRUD methods for models/entities inheriting from BaseObject
 * Extend this by passing the typeof of the desired class to the constructor
 */
export class BaseRepository<T extends BaseObjectType> {
   static currentUser: User | undefined
   static useDateFormat: boolean = true

   //implements RepositoryClass<T>
   protected _model: typeof PersistedBaseObject
   backendAdapter: BackendInterface

   constructor(
      model: typeof PersistedBaseObject,
      backendAdapter: BackendInterface = Backend.getBackend()
   ) {
      this._model = model
      this.backendAdapter = backendAdapter
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

   protected _addMetaData(
      dataObject: DataObjectClass<any>,
      action: BackendAction
   ) {
      if (BaseRepository.currentUser) {
         Backend.info(`Adding meta data on record`)
         const date = BaseRepository.useDateFormat
            ? new Date().toISOString()
            : Date.now()
         switch (action) {
            case BackendAction.CREATE:
               // Only set if not already populated
               if (!dataObject.val('createdBy')) {
                  dataObject.set('createdBy', BaseRepository.currentUser)
               }
               if (!dataObject.val('createdAt')) {
                  dataObject.set('createdAt', date)
               }
               break
            case BackendAction.UPDATE:
               // Only set if not already populated
               if (!dataObject.val('updatedBy')) {
                  dataObject.set('updatedBy', BaseRepository.currentUser)
               }
               if (!dataObject.val('updatedAt')) {
                  dataObject.set('updatedAt', date)
               }
               break
            case BackendAction.DELETE:
               // Only set if not already populated
               if (!dataObject.val('deletedBy')) {
                  dataObject.set('deletedBy', BaseRepository.currentUser)
               }
               if (!dataObject.val('deletedAt')) {
                  dataObject.set('deletedAt', date)
               }
               break
            default:
               Backend.warn(`Unrecognized action: '${action}'`)
               break
         }
      }

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

   async create<B extends PersistedBaseObject>(obj: B, uid?: string) {
      const dataObject = this._addMetaData(obj.dataObject, BackendAction.CREATE)
      const savedObj = await this.backendAdapter.create(dataObject, uid)
      return this._model.fromDataObject(savedObj)
   }

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

   async update<B extends PersistedBaseObject>(obj: B) {
      const dataObject = this._addMetaData(
         obj.dataObject || obj,
         BackendAction.UPDATE
      )

      const savedObj = await this.backendAdapter.update(dataObject)

      return this._model.fromDataObject(savedObj)
   }

   /**
    * delete object in its backend
    * @param uid string
    */
   async delete(uid: string, hardDelete = false) {
      const dataObject = this._addMetaData(
         await this.getDataObject(uid),
         BackendAction.DELETE
      )

      return await this.backendAdapter.delete(dataObject, hardDelete)
   }

   async query(query: Query<any>): Promise<QueryResultType<T>> {
      return await query.fetchAsInstances(this.backendAdapter)
   }
}
