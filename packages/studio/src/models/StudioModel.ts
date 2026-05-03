import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, ObjectProperty, htmlType, BaseObjectProperties, BaseObjectType, BooleanProperty, NumberProperty } from '@quatrain/core'

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

export class StudioModel extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioModelProperties
   static COLLECTION = 'studio_model'

   static async factory(src: any = undefined): Promise<StudioModel> {
      return super.factory(src, StudioModel)
   }
}
