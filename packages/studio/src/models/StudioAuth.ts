import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, MapProperty, BooleanProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

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

export class StudioAuth extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioAuthProperties
   static COLLECTION = 'studio_auth'

   static async factory(src: any = undefined): Promise<StudioAuth> {
      return super.factory(src, StudioAuth)
   }
}
