import { DataObject } from '../components/DataObject'
import { ObjectUri } from '../components/ObjectUri'
import { BaseProperty, BasePropertyType } from './BaseProperty'
import { BaseObjectClass } from '../components/types/BaseObjectClass'
import { Core } from '../Core'

// TODO move in types
export enum returnAs {
   AS_OBJECTURIS = 'objectUris',
   AS_DATAOBJECTS = 'dataObjects',
   AS_INSTANCES = 'classInstances',
   AS_IS = 'asIs',
}

export interface ObjectPropertyType extends BasePropertyType {
   instanceOf: any //Function | string | Object
}

export class ObjectProperty extends BaseProperty {
   static TYPE = 'object'
   _value: BaseObjectClass | ObjectUri | undefined = undefined
   _instanceOf: any //Function | string | Object

   constructor(config: ObjectPropertyType) {
      super(config)
      this._instanceOf = config.instanceOf
   }

   get instanceOf() {
      return this._instanceOf
   }

   val(transform: string | undefined = undefined) {
      try {
         if (typeof this._instanceOf === 'string') {
            this._instanceOf = Core.getClass(this._instanceOf)
         }

         if (!this._value) {
            return this._defaultValue
         }

         switch (transform) {
            case returnAs.AS_DATAOBJECTS:
               if (this._value instanceof DataObject) {
                  Core.debug(`Returning already existing dataObject`)
                  return this._value
               } else if (this._value instanceof ObjectUri) {
                  Core.debug(`Converting objectUri -> dataObject`)
                  return DataObject.factory({
                     properties: Reflect.get(
                        this._instanceOf,
                        'PROPS_DEFINITION'
                     ),
                     uri: this._value,
                  })
               } else {
                  Core.debug(`Converting instance -> dataObject`)
                  return this._value.dataObject
               }
            case returnAs.AS_INSTANCES:
               if (this._value instanceof DataObject) {
                  Core.debug(`Converting dataObject -> instance`)
                  return Reflect.construct(this._instanceOf, [this._value])
               } else if (this._value instanceof ObjectUri) {
                  Core.debug(`Converting objectUri -> dataObject -> instance`)
                  const dao = DataObject.factory({
                     properties: Reflect.get(
                        this._instanceOf,
                        'PROPS_DEFINITION'
                     ),
                     uri: this._value,
                  })
                  return Reflect.construct(this._instanceOf, [dao])
               } else {
                  Core.log(`Returning already existing instance`)
                  return this._value
               }
            case returnAs.AS_OBJECTURIS:
            default:
               return this._value
         }
      } catch (err) {
         Core.error(
            `Error in ObjectProperty.val() for property ${this._name}: ${err}`
         )
         console.log(err)
         return undefined
      }
   }

   set(value: object, setChanged = true) {
      if (
         value! instanceof ObjectUri &&
         value! instanceof DataObject &&
         value.constructor.name !== this._instanceOf.constructor.name
      ) {
         throw new Error(
            `value ${JSON.stringify(value)} is not an instance of ${
               this._instanceOf.constructor.name
            }`
         )
      }

      return super.set(value, setChanged)
   }

   toJSON() {
      if (this._value instanceof ObjectUri) {
         return this._value.toJSON()
      }

      return this._value &&
         (this._value.dataObject || this._value instanceof DataObject)
         ? this._value.dataObject.toReference()
         : null
   }
}
