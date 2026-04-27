import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, BooleanProperty, NumberProperty, htmlType, BaseObjectProperties, BaseObjectType } from '@quatrain/core'

export interface StudioPropertyType extends BaseObjectType {
   modelId: string
   name: string
   propertyType: string
   mandatory: boolean
   version: number
   options?: any
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
      name: 'options',
      mandatory: false,
      type: 'map', // MapProperty.TYPE
      htmlType: htmlType.HIDDEN,
   },
   {
      name: 'version',
      mandatory: true,
      type: NumberProperty.TYPE,
      htmlType: htmlType.NUMBER,
      defaultValue: 1,
   },
   {
      name: 'order',
      mandatory: false,
      type: NumberProperty.TYPE,
      htmlType: htmlType.NUMBER,
      defaultValue: 0,
   }
]

export class StudioProperty extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioPropertyDef
   static COLLECTION = 'studio_property'

   static async factory(src: any = undefined): Promise<StudioProperty> {
      return super.factory(src, StudioProperty)
   }
}
