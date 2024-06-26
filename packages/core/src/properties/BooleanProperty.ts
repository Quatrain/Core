import { BaseProperty, BasePropertyType } from './BaseProperty'

export interface BooleanPropertyType extends BasePropertyType {}

export class BooleanProperty extends BaseProperty {
   static TYPE = 'boolean'

   set(value: boolean, setChanged = true) {
      return super.set(value, setChanged)
   }
}
