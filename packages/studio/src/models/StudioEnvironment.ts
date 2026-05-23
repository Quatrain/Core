import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, EnumProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

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
   studioTarget?: string
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
      name: 'studioTarget',
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

/**
 * Core domain model representing a StudioEnvironment within the Quatrain Studio ecosystem.
 */
export class StudioEnvironment extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioEnvironmentProperties
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_environment'

   /**
    * Instantiates a new `StudioEnvironment` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioEnvironment> {
      return super.factory(src, StudioEnvironment)
   }
}

Core.addClass('StudioEnvironment', StudioEnvironment)

