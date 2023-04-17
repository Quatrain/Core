import { Property } from '..'

export type PropertyTypes =
   | typeof Property.TYPE_STRING
   | typeof Property.TYPE_NUMBER
   | typeof Property.TYPE_ENUM
   | typeof Property.TYPE_BOOLEAN
   | typeof Property.TYPE_OBJECT
   | typeof Property.TYPE_DATETIME
   | typeof Property.TYPE_HASH
   | typeof Property.TYPE_ARRAY

export type BaseType = { type: PropertyTypes }
