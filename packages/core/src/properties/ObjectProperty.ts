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

/**
 * Configuration dictionary for instantiating an `ObjectProperty`.
 * Defines the class type of the expected object.
 *
 * | Parameter | Type | Description | Default |
 * | :--- | :--- | :--- | :--- |
 * | `instanceOf` | any | The class constructor or class name string the object must match. | **Required** |
 */
export interface ObjectPropertyType extends BasePropertyType {
   instanceOf: any //Function | string | Object
}

/**
 * A relational property type designed to store references to other `BaseObjectClass` instances.
 * Handles polymorphic resolution between raw `ObjectUri`, underlying `DataObject`, or the full class instance.
 * 
 * @example
 * ```typescript
 * const owner = new ObjectProperty({
 *    name: 'owner',
 *    instanceOf: User
 * });
 * 
 * owner.set(userInstance);
 * const uri = owner.val(returnAs.AS_OBJECTURIS); // Returns just the reference
 * ```
 */
export class ObjectProperty extends BaseProperty {
   /** The string literal type identifier for this property. */
   static TYPE = 'object'
   /** The internal stored value, either a class instance or a URI. */
   _value: BaseObjectClass | ObjectUri | undefined = undefined
   /** The class constructor or class name string the object must match. */
   _instanceOf: any //Function | string | Object

   constructor(config: ObjectPropertyType) {
      super(config)
      this._instanceOf = config.instanceOf
   }

   get instanceOf() {
      return this._instanceOf
   }

   /**
    * Retrieves the object, optionally resolving it to a specific representation.
    * 
    * @param transform - The desired format (`returnAs.AS_OBJECTURIS`, `AS_DATAOBJECTS`, `AS_INSTANCES`).
    * @returns The resolved object, data object, or URI based on the requested transform.
    */
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

   /**
    * Assigns an object or an object reference to the property.
    * Validates that the provided object matches the `instanceOf` class definition.
    * 
    * @param value - The `BaseObjectClass`, `DataObject`, or `ObjectUri` to assign.
    * @param setChanged - Whether to mark the property as modified.
    * @returns The property instance for chaining.
    * @throws {Error} If the assigned value is not an instance of the configured class.
    */
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

   /**
    * Serializes the object property into a reference format suitable for storage.
    * 
    * @returns The `ObjectUri` JSON representation, or a reference object.
    */
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
