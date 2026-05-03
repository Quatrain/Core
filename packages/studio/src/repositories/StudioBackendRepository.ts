import { BaseRepository } from '@quatrain/backend'
import { StudioBackend, StudioBackendType } from '../models/StudioBackend'

/**
 * Repository for managing StudioBackend objects.
 */
export class StudioBackendRepository extends BaseRepository<StudioBackendType> {
   constructor(backendAdapter?: any) {
      super(StudioBackend, backendAdapter)
   }
}
