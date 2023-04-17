//import { Property } from './Property'
import { BaseProperty, BasePropertyType } from './BaseProperty'

export interface StringPropertyType extends BasePropertyType {
   minLength?: number
   maxLength?: number
   allowSpaces?: boolean
   allowDigits?: boolean
   allowLetters?: boolean
   allowPattern?: String
}

export class StringProperty extends BaseProperty {
   static TYPE = 'string'

   static TRANSFORM_UCASE = 'upper'
   static TRANSFORM_LCASE = 'lower'

   static ALLOW_SPACES = 'spaces'
   static ALLOW_LETTERS = 'letters'
   static ALLOW_DIGITS = 'digits'
   static ALLOW_STRINGS = 'strings'
   static ALLOW_NUMBERS = 'numbers'


   protected _minLength: number = 0
   protected _maxLength: number = 0

   protected _value: string | undefined


   /**
    * Set to false to bypass some rules
    */
   protected _rawValue = true

   constructor(config: StringPropertyType) {
      super(config)
      this.minLength = config.minLength || 0
      this.maxLength = config.maxLength || 0
      if (this._enable(config.allowSpaces)) {
         this._allows.push(StringProperty.ALLOW_SPACES)
      }
      if (this._enable(config.allowDigits)) {
         this._allows.push(StringProperty.ALLOW_DIGITS)
      }
      if (this._enable(config.allowLetters)) {
         this._allows.push(StringProperty.ALLOW_LETTERS)
      }
   }

   set(value: any) {
      if (
         this._allows.includes(StringProperty.ALLOW_DIGITS) === false &&
         /\d/.test(value)
      ) {
         throw new Error(`Digits are not allowed in value`)
      }

      if (
         this._allows.includes(StringProperty.ALLOW_SPACES) === false &&
         /\s/g.test(value)
      ) {
         throw new Error(`Spaces are not allowed in value`)
      }

      if (
         this._allows.includes(StringProperty.ALLOW_LETTERS) === false &&
         /[a-zA-Z]/.test(value)
      ) {
         throw new Error(`Letters are not allowed in value`)
      }

      if (this._rawValue && this._minLength > 0 && value.length < this._minLength) {
         throw new Error(`Value is too short`)
      }

      if (this._rawValue && this._maxLength > 0 && value.length > this._maxLength) {
         throw new Error(`${this._name}: value '${value}' is too long`)
      }

      return super.set(value)
   }

   get(transform: string | undefined = undefined) {
      switch (transform) {
         case StringProperty.TRANSFORM_LCASE:
            return this._value && this._value.toLowerCase()
         case StringProperty.TRANSFORM_UCASE:
            return this._value && this._value.toUpperCase()
         default:
            return this._value
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
}
