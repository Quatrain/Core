import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, MapProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioSecretType extends BaseObjectType {
   name: string
   values: Record<string, any>
   studioEnvironment: string
}

export const StudioSecretProperties: any = [
   ...BaseObjectProperties,
   {
      name: 'name',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      fullSearch: true,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'values',
      mandatory: true,
      type: MapProperty.TYPE,
   },
   {
      name: 'studioEnvironment',
      mandatory: true,
      type: StringProperty.TYPE,
   }
]

/**
 * Core domain model representing a StudioSecret within the Quatrain Studio ecosystem.
 */
export class StudioSecret extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioSecretProperties
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_secret'

   /**
    * Instantiates a new `StudioSecret` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioSecret> {
      return super.factory(src, StudioSecret)
   }
}

Core.addClass('StudioSecret', StudioSecret)

