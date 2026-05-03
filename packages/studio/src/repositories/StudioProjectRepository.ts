import { BaseRepository } from '@quatrain/backend'
import { StudioProject, StudioProjectType } from '../models/StudioProject'

/**
 * Repository for managing StudioProject objects.
 */
export class StudioProjectRepository extends BaseRepository<StudioProjectType> {
   constructor(backendAdapter?: any) {
      super(StudioProject, backendAdapter)
   }
}
