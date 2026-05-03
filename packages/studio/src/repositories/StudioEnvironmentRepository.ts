import { BaseRepository } from '@quatrain/backend'
import { StudioEnvironment, StudioEnvironmentType } from '../models/StudioEnvironment'

/**
 * Repository for managing StudioEnvironment objects.
 */
export class StudioEnvironmentRepository extends BaseRepository<StudioEnvironmentType> {
   constructor(backendAdapter?: any) {
      super(StudioEnvironment, backendAdapter)
   }
}
