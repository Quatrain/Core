import { DataObjectClass, User } from '@quatrain/core'
import { Backend, BackendAction } from '../Backend'
import BackendMiddleware from './Middleware'
import { MiddlewareParams } from './types/MiddlewareParams'
import { BaseRepository } from '../BaseRepository'

export interface InjectMetaMiddlewareParams {
   user?: User
}

/**
 * Backend middleware that automatically timestamps and logs user activity.
 * Injects `createdAt`, `updatedAt`, `deletedAt` and corresponding `By` relations
 * using the current Context user when the object undergoes CRUD operations.
 */
export class InjectMetaMiddleware implements BackendMiddleware {
   protected _user: User | undefined

   constructor(params?: InjectMetaMiddlewareParams) {
      this._user = params?.user
   }

   /**
    * Intercepts the request right before execution to append tracking metadata.
    * 
    * @param dataObject - The DataObject entering the database operation.
    * @param action - CREATE, UPDATE, or DELETE context.
    * @param params - Optional parameters passed via the adapter execution pipeline.
    */
   beforeExecute(
      dataObject: DataObjectClass<any>,
      action: BackendAction,
      params?: MiddlewareParams
   ) {
      Backend.debug(
         `[MDW] Executing Middleware ${this.constructor.name} for ${action} event`
      )
      
      const userToInject = this._user || BaseRepository.currentUser
      const date = params?.useDateFormat ? new Date().toISOString() : Date.now()
      
      switch (action) {
         // add properties existence validation
         case BackendAction.CREATE:
            if (userToInject && !dataObject.val('createdBy')) dataObject.set('createdBy', userToInject)
            if (!dataObject.val('createdAt')) dataObject.set('createdAt', date)
            break
         case BackendAction.UPDATE:
            if (userToInject && !dataObject.val('updatedBy')) dataObject.set('updatedBy', userToInject)
            if (!dataObject.val('updatedAt')) dataObject.set('updatedAt', date)
            break
         case BackendAction.DELETE:
            if (userToInject && !dataObject.val('deletedBy')) dataObject.set('deletedBy', userToInject)
            if (!dataObject.val('deletedAt')) dataObject.set('deletedAt', date)
            break
         default:
            break
      }
   }
}
