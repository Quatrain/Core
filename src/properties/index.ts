import { Property } from './Property'
import { BaseProperty, BasePropertyType } from './BaseProperty'
import { ArrayProperty, ArrayPropertyType } from './ArrayProperty'
import { NumberProperty, NumberPropertyType } from './NumberProperty'
import { StringProperty, StringPropertyType } from './StringProperty'
import { HashProperty, HashPropertyType } from './HashProperty'
import { EnumProperty, EnumPropertyType } from './EnumProperty'
import { BooleanProperty, BooleanPropertyType } from './BooleanProperty'
import { DateTimeProperty, DateTimePropertyType } from './DateTimeProperty'
import { ObjectProperty, ObjectPropertyType } from './ObjectProperty'
import { MapProperty, MapPropertyType } from './MapProperty'
import { PropertyTypes } from './types/PropertyTypes'

export {
   Property,
   BaseProperty,
   BasePropertyType,
   ArrayProperty,
   ArrayPropertyType,
   NumberProperty,
   NumberPropertyType,
   BooleanProperty,
   BooleanPropertyType,
   DateTimeProperty,
   DateTimePropertyType,
   EnumProperty,
   EnumPropertyType,
   ObjectProperty,
   ObjectPropertyType,
   StringProperty,
   StringPropertyType,
   HashProperty,
   HashPropertyType,
   MapProperty,
   MapPropertyType,
}

type BaseType = { type: PropertyTypes }

export type DataObjectProperties = (
   | (NumberPropertyType & BaseType)
   | (BooleanPropertyType & BaseType)
   | (EnumPropertyType & BaseType)
   | (ObjectPropertyType & BaseType)
   | (StringPropertyType & BaseType)
   | (HashPropertyType & BaseType)
   | (DateTimeProperty & BaseType)
   | (ArrayProperty & BaseType)
   | (MapProperty & BaseType)
)[]
