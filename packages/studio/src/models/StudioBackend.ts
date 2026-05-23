import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, NumberProperty, BooleanProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioBackendType extends BaseObjectType {
   name: string
   engine: string
   filePath?: string
   host?: string
   port?: number
   username?: string
   password?: string
   database?: string
   studioProject?: string
   credentials?: string
   isDefault?: boolean
   [x: string]: any
}

export const StudioBackendDef: any = [
   ...BaseObjectProperties,
   {
      name: 'name',
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'engine', // e.g. 'sqlite', 'postgres'
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'filePath', // used for sqlite
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'host',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'port',
      mandatory: false,
      type: NumberProperty.TYPE,
      htmlType: htmlType.NUMBER,
   },
   {
      name: 'username',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'password',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'database',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'studioProject',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'credentials',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'isDefault',
      mandatory: true,
      type: BooleanProperty.TYPE,
      htmlType: htmlType.CHECKBOX,
      defaultValue: false,
   }
]

/**
 * Core domain model representing a StudioBackend within the Quatrain Studio ecosystem.
 */
export class StudioBackend extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioBackendDef
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_backend'

   /**
    * Instantiates a new `StudioBackend` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioBackend> {
      return super.factory(src, StudioBackend)
   }
}

Core.addClass('StudioBackend', StudioBackend)

