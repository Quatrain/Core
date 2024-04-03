import { BaseProperty, BasePropertyType } from './BaseProperty'

export interface MapPropertyType extends BasePropertyType {}

export class MapProperty extends BaseProperty {
   static TYPE = 'map'

   set(value: any, setChanged = true) {
      if (typeof value! !== 'object') {
         throw new Error(`value ${JSON.stringify(value)} is not an object`)
      }

      return super.set(value, setChanged)
   }

   toJSON() {
      return this._value ? JSON.stringify(this._value) : {}
   }
}
