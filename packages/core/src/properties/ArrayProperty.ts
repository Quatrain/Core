import { BaseProperty, BasePropertyType } from './BaseProperty'
import { StringProperty } from './StringProperty'

export interface ArrayPropertyType extends BasePropertyType {
   minLength?: number
   maxLength?: number
   allowNumbers?: boolean
   allowStrings?: boolean
}

export class ArrayProperty extends BaseProperty {
   static TYPE = 'array'
   protected _value: Array<any> | undefined = undefined

   protected _minLength: number = 0
   protected _maxLength: number = 0

   constructor(config: ArrayPropertyType) {
      super(config)
      this.minLength = config.minLength || 0
      this.maxLength = config.maxLength || 0
      if (this._enable(config.allowNumbers)) {
         this._allows.push(StringProperty.ALLOW_NUMBERS)
      }
      if (this._enable(config.allowStrings)) {
         this._allows.push(StringProperty.ALLOW_STRINGS)
      }
   }

   set minLength(min: number) {
      this._minLength = min >= 0 ? min : 0
   }

   get minLength() {
      return this._minLength
   }

   set maxLength(max: number) {
      this._maxLength = max >= 0 ? max : 0
   }
   get maxLength() {
      return this._maxLength
   }

   set(value: Array<any>, setChanged = true) {
      if (!value) {
         value = []
      }
      if (!Array.isArray(value)) {
         throw new Error(`value ${JSON.stringify(value)} is not an array`)
      }

      if (this._minLength > 0 && value.length < this._minLength) {
         throw new Error(`Array has too few values`)
      }

      if (this._maxLength > 0 && value.length > this._maxLength) {
         throw new Error(`Array values are too many`)
      }

      const joined = value.join()

      if (
         this._allows.includes(StringProperty.ALLOW_STRINGS) === false &&
         /[a-zA-Z]/.test(joined)
      ) {
         throw new Error(`Strings are not allowed in value`)
      }

      if (
         this._allows.includes(StringProperty.ALLOW_NUMBERS) === false &&
         /\d/.test(joined)
      ) {
         throw new Error(`Numbers are not allowed in value`)
      }

      return super.set(value, setChanged)
   }

   get(transform: Function | undefined = undefined) {
      return transform ? transform(this._value) : this._value
   }

   toJSON() {
      return this._value
   }
}
