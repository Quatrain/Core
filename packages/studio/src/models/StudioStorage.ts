import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, MapProperty, BooleanProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioStorageType extends BaseObjectType {
   name: string
   provider: string
   options?: Record<string, any>
   isDefault?: boolean
}

export const StudioStorageProperties: any = [
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
         values: ['s3', 'local', 'gcs']
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
 * Core domain model representing a StudioStorage within the Quatrain Studio ecosystem.
 */
export class StudioStorage extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioStorageProperties
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_storage'

   /**
    * Instantiates a new `StudioStorage` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioStorage> {
      return super.factory(src, StudioStorage)
   }
}

Core.addClass('StudioStorage', StudioStorage)

