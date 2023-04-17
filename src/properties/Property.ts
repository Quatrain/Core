import { DataObjectClass } from '../components/types/DataObjectClass'
import { BaseProperty, BasePropertyType } from './BaseProperty'
import { BooleanProperty } from './BooleanProperty'
import { DateTimeProperty } from './DateTimeProperty'
import { EnumProperty } from './EnumProperty'
import { HashProperty } from './HashProperty'
import { ObjectProperty } from './ObjectProperty'
import { StringProperty } from './StringProperty'
import { NumberProperty } from './NumberProperty'

export class Property {
   static TYPE_ANY = 'any'
   static TYPE_NUMBER = 'number'
   static TYPE_STRING = 'string'
   static TYPE_OBJECT = 'object'
   static TYPE_ENUM = 'enum'
   static TYPE_BOOLEAN = 'boolean'
   static TYPE_HASH = 'hash'
   static TYPE_DATETIME = 'datetime'
   static TYPE_ARRAY = 'array'

   static ALLOW_SPACES = 'spaces'
   static ALLOW_LETTERS = 'letters'
   static ALLOW_DIGITS = 'digits'
   static ALLOW_STRINGS = 'strings'
   static ALLOW_NUMBERS = 'numbers'

   static factory<P extends BasePropertyType>(
      params: P,
      parent: DataObjectClass
   ) {
      params.parent = parent
      switch (params.type) {
         case Property.TYPE_ANY:
            return new BaseProperty(params)

         case Property.TYPE_STRING:
            return new StringProperty(params)

         case Property.TYPE_NUMBER:
            return new NumberProperty(params)

         case Property.TYPE_OBJECT:
            return new ObjectProperty(params)

         case Property.TYPE_ENUM:
            return new EnumProperty(params)

         case Property.TYPE_BOOLEAN:
            return new BooleanProperty(params)

         case Property.TYPE_HASH:
            return new HashProperty(params)

         case Property.TYPE_DATETIME:
            return new DateTimeProperty(params)
         default:
            throw new Error(`Unknown property type ${params.type}`)
      }
   }
}
