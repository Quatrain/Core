import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioHistoryType extends BaseObjectType {
   action: string
   entityType: string
   entity: string
   entityName?: string
   user?: string
   details?: string
   [x: string]: any
}

export const StudioHistoryDef: any = [
   ...BaseObjectProperties,
   {
      name: 'action',
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'entityType',
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'entity',
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'entityName',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'user',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'details',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   }
]

export class StudioHistory extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioHistoryDef
   static COLLECTION = 'studio_history'

   static async factory(src: any = undefined): Promise<StudioHistory> {
      return super.factory(src, StudioHistory)
   }
}
