import { BaseRepository } from '@quatrain/backend'
import { StudioDeployment, StudioDeploymentType } from '../models/StudioDeployment'

/**
 * Repository for managing StudioDeployment objects.
 */
export class StudioDeploymentRepository extends BaseRepository<StudioDeploymentType> {
   constructor(backendAdapter?: any) {
      super(StudioDeployment, backendAdapter)
   }
}
