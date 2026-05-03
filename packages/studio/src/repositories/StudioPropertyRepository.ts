import { BaseRepository } from '@quatrain/backend'
import { StudioProperty, StudioPropertyType } from '../models/StudioProperty'

/**
 * Repository for managing StudioProperty objects.
 */
export class StudioPropertyRepository extends BaseRepository<StudioPropertyType> {
   constructor(backendAdapter?: any) {
      super(StudioProperty, backendAdapter)
   }
}
