import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, MapProperty, BooleanProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioAuthType extends BaseObjectType {
   name: string
   provider: string
   options?: Record<string, any>
   isDefault?: boolean
}

export const StudioAuthProperties: any = [
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
      name: 'provider',
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.SELECT,
      options: {
         values: ['pocketbase', 'supabase', 'firebase']
      }
   },
   {
      name: 'options',
      mandatory: false,
      type: MapProperty.TYPE,
   },
   {
      name: 'isDefault',
      mandatory: false,
      type: BooleanProperty.TYPE,
      defaultValue: false,
   }
]

/**
 * Core domain model representing a StudioAuth within the Quatrain Studio ecosystem.
 */
export class StudioAuth extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioAuthProperties
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_auth'

   /**
    * Instantiates a new `StudioAuth` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioAuth> {
      return super.factory(src, StudioAuth)
   }
}

Core.addClass('StudioAuth', StudioAuth)

