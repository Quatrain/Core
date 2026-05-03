import { BaseRepository } from '@quatrain/backend'
import { StudioView, StudioViewType } from '../models/StudioView'

/**
 * Repository for managing StudioView objects.
 */
export class StudioViewRepository extends BaseRepository<StudioViewType> {
   constructor(backendAdapter?: any) {
      super(StudioView, backendAdapter)
   }
}
