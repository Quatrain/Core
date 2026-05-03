import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, ObjectProperty, BaseObjectType, htmlType } from '@quatrain/core'

export interface StudioTargetType extends BaseObjectType {
   name: string
   targetType: string
   options?: any
}

export const StudioTargetProperties: any = [
   {
      name: 'name',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'targetType',
      mandatory: true,
      type: StringProperty.TYPE,
      defaultValue: 'docker-compose',
   },
   {
      name: 'options',
      mandatory: false,
      type: ObjectProperty.TYPE,
   }
]

export class StudioTarget extends PersistedBaseObject {
   static PROPS_DEFINITION = StudioTargetProperties
   static COLLECTION = 'studio_target'

   static async factory(src: any = undefined): Promise<StudioTarget> {
      return super.factory(src, StudioTarget)
   }
}
