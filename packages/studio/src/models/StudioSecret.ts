import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, MapProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

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

export class StudioSecret extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioSecretProperties
   static COLLECTION = 'studio_secret'

   static async factory(src: any = undefined): Promise<StudioSecret> {
      return super.factory(src, StudioSecret)
   }
}
