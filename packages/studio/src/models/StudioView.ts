import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, htmlType, BaseObjectProperties, BaseObjectType } from '@quatrain/core'

export interface StudioViewType extends BaseObjectType {
   name: string
   route: string
   layout?: any // JSON composition of widgets
   [x: string]: any
}

export const StudioViewDef: any = [
   ...BaseObjectProperties,
   {
      name: 'name',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'route',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'layout',
      mandatory: false,
      type: 'map', // MapProperty.TYPE
      htmlType: htmlType.HIDDEN,
   }
]

export class StudioView extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioViewDef
   static COLLECTION = 'studio_view'

   static async factory(src: any = undefined): Promise<StudioView> {
      return super.factory(src, StudioView)
   }
}
