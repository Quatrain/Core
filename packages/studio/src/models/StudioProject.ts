import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, ArrayProperty, htmlType, BaseObjectProperties, BaseObjectType, DataObjectClass } from '@quatrain/core'

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

export class StudioProject extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioProjectProperties
   static COLLECTION = 'studio_project'

   static async factory(src: any = undefined): Promise<StudioProject> {
      return super.factory(src, StudioProject)
   }
}
