import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, BooleanProperty, NumberProperty, MapProperty, htmlType, BaseObjectProperties, BaseObjectType } from '@quatrain/core'

export interface StudioPropertyType extends BaseObjectType {
   studioModel: string
   name: string
   propertyType: string
   mandatory: boolean
   version: number
   options?: any
   ui?: any
   [x: string]: any
}

export const StudioPropertyDef: any = [
   ...BaseObjectProperties,
   {
      name: 'studioModel',
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
      type: MapProperty.TYPE,
      htmlType: htmlType.HIDDEN,
   },
   {
      name: 'ui',
      mandatory: false,
      type: MapProperty.TYPE,
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

/**
 * Core domain model representing a StudioProperty within the Quatrain Studio ecosystem.
 */
export class StudioProperty extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioPropertyDef
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_property'

   /**
    * Instantiates a new `StudioProperty` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioProperty> {
      return super.factory(src, StudioProperty)
   }
}

Core.addClass('StudioProperty', StudioProperty)

