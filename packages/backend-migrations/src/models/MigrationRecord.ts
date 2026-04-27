import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty } from '@quatrain/core'

/**
 * MigrationRecord Model
 * Stores the state of executed migrations in the target backend.
 */
export class MigrationRecord extends PersistedBaseObject {
   static COLLECTION = '_quatrain_migrations'
   
   static PROPS_DEFINITION = [
      ...PersistedBaseObject.PROPS_DEFINITION,
      {
         name: 'name',
         type: StringProperty.TYPE,
         mandatory: true,
      }
   ]
}
