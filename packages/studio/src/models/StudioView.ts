import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, MapProperty, htmlType, BaseObjectProperties, BaseObjectType } from '@quatrain/core'

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
      type: MapProperty.TYPE,
      htmlType: htmlType.HIDDEN,
   }
]

/**
 * Core domain model representing a StudioView within the Quatrain Studio ecosystem.
 */
export class StudioView extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioViewDef
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_view'

   /**
    * Instantiates a new `StudioView` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioView> {
      return super.factory(src, StudioView)
   }
}

Core.addClass('StudioView', StudioView)

