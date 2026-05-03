import { BackendMiddleware, BackendAction, Backend } from '@quatrain/backend'
import { DataObjectClass, statuses } from '@quatrain/core'
import { StudioHistory } from '@quatrain/studio'

export class HistoryMiddleware implements BackendMiddleware {
   async execute(dataObject: DataObjectClass<any>, action: BackendAction, params?: any): Promise<void> {
      try {
         const entityType = dataObject.uri.class ? dataObject.uri.class.name : dataObject.uri.collection
         
         // Prevent infinite loops by not logging history of history
         if (entityType === 'StudioHistory' || entityType === 'studio_history') {
            return
         }

         let entityName = ''
         if (dataObject.has('name')) {
            entityName = dataObject.val('name') || ''
         }

         let historyAction = action.toUpperCase()
         if (action === BackendAction.UPDATE && dataObject.has('status') && dataObject.val('status') === statuses.DELETED) {
             historyAction = 'DELETE'
         }

         // To avoid recursive issues with save(), we'll use Backend.getBackend().create directly
         // if necessary, but using factory() + save() is safe here because we exclude StudioHistory above.
         const history = await StudioHistory.factory()
         history.set('action', historyAction)
         history.set('entityType', entityType)
         history.set('entity', dataObject.uid)
         history.set('entityName', entityName)
         
         await history.save()
         
         Backend.debug(`[History] Logged ${historyAction} for ${entityType} ${dataObject.uid}`)
      } catch (e) {
         Backend.error(`[History] Failed to save history: ${e}`)
      }
   }
}
