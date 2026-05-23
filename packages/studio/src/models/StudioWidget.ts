import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, MapProperty, htmlType, BaseObjectProperties, BaseObjectType } from '@quatrain/core'

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
      type: MapProperty.TYPE,
      htmlType: htmlType.HIDDEN,
   }
]

/**
 * Core domain model representing a StudioWidget within the Quatrain Studio ecosystem.
 */
export class StudioWidget extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioWidgetDef
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_widget'

   /**
    * Instantiates a new `StudioWidget` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioWidget> {
      return super.factory(src, StudioWidget)
   }
}

Core.addClass('StudioWidget', StudioWidget)

