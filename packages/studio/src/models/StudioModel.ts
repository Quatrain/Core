import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, htmlType, BaseObjectProperties, BaseObjectType, BooleanProperty, NumberProperty } from '@quatrain/core'

export interface StudioModelType extends BaseObjectType {
   studioProject: string
   name: string
   collectionName: string
   isPersisted: boolean
   version: number
   [x: string]: any
}

export const StudioModelProperties: any = [
   ...BaseObjectProperties,
   {
      name: 'studioProject',
      mandatory: true,
      type: StringProperty.TYPE, // In real Quatrain, this might be an ObjectProperty referencing StudioProject, but storing ID is simpler
      htmlType: htmlType.HIDDEN,
   },
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
      name: 'collectionName',
      mandatory: false,
      type: StringProperty.TYPE,
      maxLength: 100,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'isPersisted',
      mandatory: true,
      type: BooleanProperty.TYPE,
      htmlType: htmlType.CHECKBOX,
      defaultValue: true,
   },
   {
      name: 'version',
      mandatory: true,
      type: NumberProperty.TYPE,
      htmlType: htmlType.NUMBER,
      defaultValue: 1,
   }
]

/**
 * Core domain model representing a StudioModel within the Quatrain Studio ecosystem.
 */
export class StudioModel extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioModelProperties
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_model'

   /**
    * Instantiates a new `StudioModel` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioModel> {
      return super.factory(src, StudioModel)
   }
}

Core.addClass('StudioModel', StudioModel)

