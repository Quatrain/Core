import { BackendAction } from '../Backend'
import { DataObjectClass } from '@quatrain/core'

export default interface BackendMiddleware {
   /**
    * Legacy execute method, will be run before the action.
    * @deprecated Use `beforeExecute` instead.
    */
   execute?: (
      dataObject: DataObjectClass<any>,
      action: BackendAction,
      params?: any
   ) => void

   /**
    * Executes before the backend action is committed.
    * Useful for validation, default value injection, etc.
    */
   beforeExecute?: (
      dataObject: DataObjectClass<any>,
      action: BackendAction,
      params?: any
   ) => Promise<void> | void

   /**
    * Executes after the backend action is successfully committed.
    * Useful for cache invalidation, event emitting, etc.
    */
   afterExecute?: (
      dataObject: DataObjectClass<any>,
      action: BackendAction,
      params?: any
   ) => Promise<void> | void
}
