import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, BooleanProperty, NumberProperty, htmlType, BaseObjectProperties, BaseObjectType } from '@quatrain/core'

export interface StudioPropertyType extends BaseObjectType {
   modelId: string
   name: string
   propertyType: string
   mandatory: boolean
   minLength?: number
   maxLength?: number
   [x: string]: any
}

export const StudioPropertyDef: any = [
   ...BaseObjectProperties,
   {
      name: 'modelId',
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.HIDDEN,
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
      name: 'propertyType', // e.g. 'StringProperty', 'NumberProperty'
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'mandatory',
      mandatory: true,
      type: BooleanProperty.TYPE,
      htmlType: htmlType.CHECKBOX,
   },
   {
      name: 'minLength',
      mandatory: false,
      type: NumberProperty.TYPE,
      htmlType: htmlType.NUMBER,
   },
   {
      name: 'maxLength',
      mandatory: false,
      type: NumberProperty.TYPE,
      htmlType: htmlType.NUMBER,
   }
]

export class StudioProperty extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioPropertyDef
   static COLLECTION = 'studio_property'

   static async factory(src: any = undefined): Promise<StudioProperty> {
      return super.factory(src, StudioProperty)
   }
}
