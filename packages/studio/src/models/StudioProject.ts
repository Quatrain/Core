import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, ArrayProperty, htmlType, BaseObjectProperties, BaseObjectType } from '@quatrain/core'

export interface StudioProjectType extends BaseObjectType {
   name: string
   description?: string
   recipe?: string
   authMode?: string
   defaultLanguage?: string
   languages?: string[]
   [x: string]: any
}

export const StudioProjectProperties: any = [
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
      name: 'description',
      mandatory: false,
      type: StringProperty.TYPE,
      maxLength: 500,
      htmlType: htmlType.TEXTAREA,
   },
   {
      name: 'recipe',
      mandatory: false,
      type: StringProperty.TYPE,
   },
   {
      name: 'authMode',
      mandatory: false,
      type: StringProperty.TYPE,
      defaultValue: 'none',
   },
   {
      name: 'defaultLanguage',
      mandatory: false,
      type: StringProperty.TYPE,
      defaultValue: 'en',
   },
   {
      name: 'languages',
      mandatory: false,
      type: ArrayProperty.TYPE,
      itemType: StringProperty.TYPE,
      defaultValue: ['en', 'fr'],
   }
]

/**
 * Core domain model representing a StudioProject within the Quatrain Studio ecosystem.
 */
export class StudioProject extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioProjectProperties
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_project'

   /**
    * Instantiates a new `StudioProject` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioProject> {
      return super.factory(src, StudioProject)
   }
}

Core.addClass('StudioProject', StudioProject)

