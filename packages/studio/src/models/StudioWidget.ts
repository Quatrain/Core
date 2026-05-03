import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, htmlType, BaseObjectProperties, BaseObjectType } from '@quatrain/core'

export interface StudioWidgetType extends BaseObjectType {
   studioModel?: string
   name: string
   widgetType: string // e.g. 'form', 'list', 'map'
   layout?: any // JSON map configuration
   [x: string]: any
}

export const StudioWidgetDef: any = [
   ...BaseObjectProperties,
   {
      name: 'studioModel',
      mandatory: false,
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
      name: 'widgetType',
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.SELECT,
      options: {
         values: ['form', 'list', 'map']
      }
   },
   {
      name: 'layout',
      mandatory: false,
      type: 'map', // MapProperty.TYPE
      htmlType: htmlType.HIDDEN,
   }
]

export class StudioWidget extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioWidgetDef
   static COLLECTION = 'studio_widget'

   static async factory(src: any = undefined): Promise<StudioWidget> {
      return super.factory(src, StudioWidget)
   }
}
