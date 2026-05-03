import { BaseRepository } from '@quatrain/backend'
import { StudioModel, StudioModelType } from '../models/StudioModel'

/**
 * Repository for managing StudioModel objects.
 */
export class StudioModelRepository extends BaseRepository<StudioModelType> {
   constructor(backendAdapter?: any) {
      super(StudioModel, backendAdapter)
   }
}
