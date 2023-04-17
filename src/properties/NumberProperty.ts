import { BaseProperty, BasePropertyType } from './BaseProperty'

export type NumberSign =
   | typeof NumberProperty.TYPE_SIGNED
   | typeof NumberProperty.TYPE_UNSIGNED

export type NumberType =
   | typeof NumberProperty.TYPE_INTEGER
   | typeof NumberProperty.TYPE_FLOAT

export interface NumberPropertyType extends BasePropertyType {
   minVal?: number
   maxVal?: number
   sign?: NumberSign
   type?: NumberType
   prefix?: string
   suffix?: string
   precision?: number
}

export class NumberProperty extends BaseProperty {
   static type = 'number'
   static TYPE_SIGNED = 'signed'
   static TYPE_UNSIGNED = 'unsigned'

   static TYPE_INTEGER = 'integer'
   static TYPE_FLOAT = 'float'

   static SEPARATOR = ' '

   static TRANSFORM_FORMATTED = 'formatted'

   protected _minVal: number | undefined = undefined
   protected _maxVal: number | undefined = undefined
   protected _type: NumberType = NumberProperty.TYPE_INTEGER
   protected _sign: NumberSign = NumberProperty.TYPE_SIGNED
   protected _prefix: string = ''
   protected _suffix: string = ''
   protected _precision: number = 0

   protected _value: number | undefined

   constructor(config: NumberPropertyType) {
      super(config)
      this.minVal = config.minVal || undefined
      this.maxVal = config.maxVal || undefined
      this._prefix = config.prefix
         ? `${config.prefix}${NumberProperty.SEPARATOR}`
         : ''
      this._suffix = config.suffix
         ? `${NumberProperty.SEPARATOR}${config.suffix}`
         : ''
      if (config.type) {
         this._type = config.type
      }
      if (config.sign) {
         this._sign = config.sign
      }
   }

   set(value: number) {
      if (this._sign === NumberProperty.TYPE_UNSIGNED && value < 0) {
         throw new Error(`Value must be unsigned`)
      }

      if (this._minVal && value < this._minVal) {
         throw new Error(`Value is below ${this._minVal}`)
      }

      if (this._maxVal && value > this._maxVal) {
         throw new Error(`Value is above ${this._maxVal}`)
      }

      if (this._type === NumberProperty.TYPE_INTEGER) {
         value = Math.floor(value)
      }

      return super.set(value)
   }

   val(transform: string | undefined = undefined) {
      switch (transform) {
         case NumberProperty.TRANSFORM_FORMATTED:
            return `${this._prefix}${this._value}${this._suffix}`

         default:
            return this._value
      }
   }

   set minVal(min: number | undefined) {
      this._minVal = min
   }

   get minVal() {
      return this._minVal
   }

   set maxVal(max: number | undefined) {
      this._maxVal = max
   }

   get maxVal() {
      return this._maxVal
   }

   get type() {
      return this._type
   }
}
