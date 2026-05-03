import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, EnumProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioEnvironmentType extends BaseObjectType {
   studioProject: string
   name: string
   studioBackend?: string
   studioStorage?: string
   studioAuth?: string
   environment?: string
   backendStudioSecret?: string
   storageStudioSecret?: string
   authStudioSecret?: string
}

export const StudioEnvironmentProperties: any = [
   ...BaseObjectProperties,
   {
      name: 'studioProject',
      mandatory: true,
      type: StringProperty.TYPE,
   },
   {
      name: 'name',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'studioBackend',
      mandatory: false,
      type: StringProperty.TYPE,
   },
   {
      name: 'studioStorage',
      mandatory: false,
      type: StringProperty.TYPE,
   },
   {
      name: 'studioAuth',
      mandatory: false,
      type: StringProperty.TYPE,
   },
   {
      name: 'backendStudioSecret',
      mandatory: false,
      type: StringProperty.TYPE,
   },
   {
      name: 'storageStudioSecret',
      mandatory: false,
      type: StringProperty.TYPE,
   },
   {
      name: 'authStudioSecret',
      mandatory: false,
      type: StringProperty.TYPE,
   },
   {
      name: 'environment',
      mandatory: true,
      type: EnumProperty.TYPE,
      defaultValue: 'development',
      values: ['development', 'staging', 'production'],
      options: {
         values: ['development', 'staging', 'production'],
         badge: true
      }
   }
]

export class StudioEnvironment extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioEnvironmentProperties
   static COLLECTION = 'studio_environment'

   static async factory(src: any = undefined): Promise<StudioEnvironment> {
      return super.factory(src, StudioEnvironment)
   }
}
