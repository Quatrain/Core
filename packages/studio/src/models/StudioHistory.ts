import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

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

/**
 * Core domain model representing a StudioHistory within the Quatrain Studio ecosystem.
 */
export class StudioHistory extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioHistoryDef
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_history'

   /**
    * Instantiates a new `StudioHistory` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioHistory> {
      return super.factory(src, StudioHistory)
   }
}

Core.addClass('StudioHistory', StudioHistory)

