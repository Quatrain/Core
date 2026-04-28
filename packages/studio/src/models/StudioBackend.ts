import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, NumberProperty, BooleanProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioBackendType extends BaseObjectType {
   name: string
   engine: string
   filePath?: string
   host?: string
   port?: number
   username?: string
   password?: string
   database?: string
   projectId?: string
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
      name: 'projectId',
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

export class StudioBackend extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioBackendDef
   static COLLECTION = 'studio_backend'

   static async factory(src: any = undefined): Promise<StudioBackend> {
      return super.factory(src, StudioBackend)
   }
}
