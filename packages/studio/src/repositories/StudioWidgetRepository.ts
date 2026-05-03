import { BaseRepository } from '@quatrain/backend'
import { StudioWidget, StudioWidgetType } from '../models/StudioWidget'

/**
 * Repository for managing StudioWidget objects.
 */
export class StudioWidgetRepository extends BaseRepository<StudioWidgetType> {
   constructor(backendAdapter?: any) {
      super(StudioWidget, backendAdapter)
   }
}
