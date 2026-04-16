import { DataObjectClass, User } from '@quatrain/core'
import { Backend, BackendAction } from '../Backend'
import BackendMiddleware from './Middleware'
import { MiddlewareParams } from './types/MiddlewareParams'
import { BaseRepository } from '../BaseRepository'

export interface InjectMetaMiddlewareParams {
   user?: User
}

export class InjectMetaMiddleware implements BackendMiddleware {
   protected _user: User | undefined

   constructor(params?: InjectMetaMiddlewareParams) {
      this._user = params?.user
   }

   execute(
      dataObject: DataObjectClass<any>,
      action: BackendAction,
      params?: MiddlewareParams
   ) {
      Backend.log(
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
