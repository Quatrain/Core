import { DataObjectClass } from '../components/types/DataObjectClass'
import { AbstractPropertyType } from './types/AbstractPropertyType'
import { PropertyClassType } from './types/PropertyClassType'
import { PropertyHTMLType } from './types/PropertyHTMLType'

export type EventTypes =
   | typeof BaseProperty.EVENT_ONCHANGE
   | typeof BaseProperty.EVENT_ONDELETE

/**
 * Configuration dictionary for instantiating a BaseProperty.
 * Defines the behavior, constraints, and default state of a property within a Quatrain DataObject.
 *
 * | Parameter | Type | Description | Default |
 * | :--- | :--- | :--- | :--- |
 * | `name` | string | The canonical name of the property. | **Required** |
 * | `id` | string | The internal identifier (defaults to lowercase `name`). | `name.toLowerCase()` |
 * | `parent` | DataObjectClass | The parent object containing this property. | `undefined` |
 * | `protected` | boolean | If true, the value can only be set once and becomes read-only. | `false` |
 * | `mandatory` | boolean | If true, the property must have a value before saving. | `false` |
 * | `unique` | boolean | If true, backends able to do so refuse two records holding the same value. | `false` |
 * | `defaultValue` | any | The default value or a function returning the default value. | `undefined` |
 * | `htmlType` | PropertyHTMLType | The suggested HTML input type for rendering in a UI. | `'off'` |
 * | `onChange` | function | Callback triggered whenever the property value is modified. | `undefined` |
 */
export interface BasePropertyType extends AbstractPropertyType {
   parent?: DataObjectClass<any>
   protected?: boolean
   mandatory?: boolean
   /** When true, backends able to do so refuse two records holding the same value. */
   unique?: boolean
   defaultValue?: any
   htmlType?: PropertyHTMLType
   onChange?: (dao: DataObjectClass<any>) => DataObjectClass<any>
}

// TODO: add `meta: boolean`. If meta is true, it is a meta-property strictly manipulated by the backend, and read-only for the user.

/**
 * The core foundation class for all Quatrain properties.
 * It manages the state, immutability (protected), change tracking, and events of a data field.
 * 
 * @example
 * ```typescript
 * const myProp = new BaseProperty({
 *    name: 'status',
 *    defaultValue: 'active',
 *    protected: false,
 *    onChange: (dao) => console.log('Status changed on', dao.id)
 * });
 * 
 * myProp.set('inactive');
 * console.log(myProp.val()); // "inactive"
 * ```
 */
export class BaseProperty implements PropertyClassType {
   /** The string literal type identifier for this property. */
   static TYPE = 'any'
   /** Event name triggered when the property value changes. */
   static EVENT_ONCHANGE = 'onChange'
   /** Event name triggered when the property is deleted. */
   static EVENT_ONDELETE = 'onDelete'

   protected _parent: DataObjectClass<any> | undefined
   protected _id: string
   protected _name: string
   protected _value: any = undefined
   protected _mandatory: boolean = false
   protected _unique: boolean = false
   protected _protected: boolean = false
   protected _allows: string[] = []
   protected _htmlType: PropertyHTMLType = 'off'
   protected _defaultValue: any
   protected _hasChanged: boolean
   protected _events: {
      [key: EventTypes]: Function
   } = {}

   constructor(config: BasePropertyType) {
      this._parent = config.parent
      this._id = config.id || config.name.toLowerCase()
      this._name = config.name
      this._protected = config.protected || false
      this._mandatory = config.mandatory || false
      this._unique = config.unique === true
      this._defaultValue =
         typeof config.defaultValue === 'function'
            ? config.defaultValue()
            : config.defaultValue
      this._value = this._defaultValue
      this._hasChanged = false
      this._htmlType = config.htmlType || 'off'
      if (typeof config.onChange === 'function') {
         this._events.onChange = config.onChange
      }
   }

   get name() {
      return this._name
   }

   get mandatory() {
      return this._mandatory
   }

   /** Whether the backend must keep the value unique within the collection. */
   get unique() {
      return this._unique
   }

   get protected() {
      return this._protected
   }

   get allows() {
      return this._allows
   }

   set htmlType(type: PropertyHTMLType) {
      this._htmlType = type
   }

   get htmlType() {
      return this._htmlType
   }

   get hasChanged() {
      return this._hasChanged
   }

   set hasChanged(val: boolean) {
      this._hasChanged = val
   }

   /**
    * Sets a new value for the property and triggers the `onChange` event if modified.
    * 
    * @param value - The new value to assign.
    * @param setChanged - Whether to mark the property as modified (defaults to true).
    * @returns The current property instance for chaining.
    * @throws {Error} If the property is marked as `protected` and already has a value.
    */
   set(value: any, setChanged: boolean = true) {
      if (
         this._value !== undefined &&
         this._value !== null &&
         this._value !== this._defaultValue &&
         this._protected === true
      ) {
         throw new Error(
            `Value '${this._name}' already defined as '${this._value}' and protected from change`
         )
      }

      let isDifferent = false

      if (typeof value === 'object' && value !== null) {
         if (value === this._value) {
            // Same reference implies it was mutated in place, force change
            isDifferent = true
         } else {
            try {
               isDifferent =
                  JSON.stringify({ value: value }) !==
                  JSON.stringify({ value: this._value })
            } catch (e) {
               // Fallback for circular references or other stringify errors
               isDifferent = true
            }
         }
      } else {
         isDifferent = value !== this._value
      }

      if (isDifferent) {
         this._value = value
         this._hasChanged = setChanged
      }

      if (this._events[BaseProperty.EVENT_ONCHANGE]) {
         this._events[BaseProperty.EVENT_ONCHANGE](this._parent)
      }

      return this
   }

   /**
    * Retrieves the current value of the property, or its default value if currently undefined.
    * 
    * @param transform - An optional transformation function applied to the value before returning it.
    * @returns The raw or transformed property value.
    */
   val(transform: any = undefined): any {
      // console.log(transform && transform(this._value), typeof transform);
      return typeof transform === 'function'
         ? transform(this._value)
         : this._value !== undefined
         ? this._value
         : this._defaultValue
   }

   protected _enable(value: boolean | undefined) {
      return value === undefined || value === true
   }

   /**
    * Serializes the property for JSON stringification.
    * 
    * @returns The raw internal value of the property.
    */
   toJSON() {
      return this._value
   }

   /**
    * Creates a deep clone of the current property instance, preserving its prototype chain.
    * 
    * @returns A new independent instance of the property.
    */
   clone() {
      const cloned = Object.create(
         Object.getPrototypeOf(this),
         Object.getOwnPropertyDescriptors(this)
      )

      return cloned
   }
}
