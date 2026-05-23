import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, ObjectProperty, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioTargetType extends BaseObjectType {
   name: string
   targetType: string
   options?: any
}

export const StudioTargetProperties: any = [
   {
      name: 'name',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'targetType',
      mandatory: true,
      type: StringProperty.TYPE,
      defaultValue: 'docker-compose',
   },
   {
      name: 'options',
      mandatory: false,
      type: ObjectProperty.TYPE,
   }
]

/**
 * Core domain model representing a StudioTarget within the Quatrain Studio ecosystem.
 */
export class StudioTarget extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioTargetProperties
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_target'

   /**
    * Instantiates a new `StudioTarget` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioTarget> {
      return super.factory(src, StudioTarget)
   }
}

Core.addClass('StudioTarget', StudioTarget)

