import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, EnumProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioEnvironmentType extends BaseObjectType {
   projectId: string
   name: string
   backendId?: string
   storageId?: string
   authId?: string
   environment?: string
}

export const StudioEnvironmentProperties: any = [
   ...BaseObjectProperties,
   {
      name: 'projectId',
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
      name: 'backendId',
      mandatory: false,
      type: StringProperty.TYPE,
   },
   {
      name: 'storageId',
      mandatory: false,
      type: StringProperty.TYPE,
   },
   {
      name: 'authId',
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
