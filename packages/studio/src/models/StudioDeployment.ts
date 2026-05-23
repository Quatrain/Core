import { PersistedBaseObject } from '@quatrain/backend'
import { Core, StringProperty, NumberProperty, BaseObjectProperties, BaseObjectType, htmlType } from '@quatrain/core'

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

/**
 * Core domain model representing a StudioDeployment within the Quatrain Studio ecosystem.
 */
export class StudioDeployment extends PersistedBaseObject {
   /** The schema definition dictating the properties of this model. */
   static PROPS_DEFINITION = StudioDeploymentDef
   /** The underlying database collection or table name. */
   static COLLECTION = 'studio_deployment'

   /**
    * Instantiates a new `StudioDeployment` or loads one from the database.
    * 
    * @param src - Initial data or an existing URI/ID.
    * @returns A promise resolving to the model instance.
    */
   static async factory(src: any = undefined): Promise<StudioDeployment> {
      return super.factory(src, StudioDeployment)
   }
}

Core.addClass('StudioDeployment', StudioDeployment)

