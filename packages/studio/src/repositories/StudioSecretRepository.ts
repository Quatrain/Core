import { BaseRepository } from '@quatrain/backend'
import { StudioSecret, StudioSecretType } from '../models/StudioSecret'

/**
 * Repository for managing StudioSecret objects.
 */
export class StudioSecretRepository extends BaseRepository<StudioSecretType> {
   constructor(backendAdapter?: any) {
      super(StudioSecret, backendAdapter)
   }
}
