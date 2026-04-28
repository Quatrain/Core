import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, MapProperty, BooleanProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

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

export class StudioStorage extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioStorageProperties
   static COLLECTION = 'studio_storage'

   static async factory(src: any = undefined): Promise<StudioStorage> {
      return super.factory(src, StudioStorage)
   }
}
