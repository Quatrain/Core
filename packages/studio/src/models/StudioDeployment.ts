import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, NumberProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioDeploymentType extends BaseObjectType {
   studioModel: string
   studioBackend: string
   version: number
   migrationSql: string
   [x: string]: any
}

export const StudioDeploymentDef: any = [
   ...BaseObjectProperties,
   {
      name: 'studioModel',
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.HIDDEN,
   },
   {
      name: 'studioBackend',
      mandatory: true,
      type: StringProperty.TYPE,
      htmlType: htmlType.HIDDEN,
   },
   {
      name: 'version',
      mandatory: true,
      type: NumberProperty.TYPE,
      htmlType: htmlType.NUMBER,
   },
   {
      name: 'migrationSql',
      mandatory: false,
      type: StringProperty.TYPE,
      htmlType: htmlType.TEXT, // Could be long text / textarea
   }
]

export class StudioDeployment extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioDeploymentDef
   static COLLECTION = 'studio_deployment'

   static async factory(src: any = undefined): Promise<StudioDeployment> {
      return super.factory(src, StudioDeployment)
   }
}
