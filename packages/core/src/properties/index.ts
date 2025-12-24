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
import { FileProperty, FilePropertyType } from './FileProperty'
import {
   CollectionProperty,
   CollectionPropertyType,
} from './CollectionProperty'
import { PropertyTypes } from './types/PropertyTypes'

export {
   Property,
   BaseProperty,
   ArrayProperty,
   NumberProperty,
   BooleanProperty,
   DateTimeProperty,
   EnumProperty,
   ObjectProperty,
   StringProperty,
   HashProperty,
   MapProperty,
   FileProperty,
   CollectionProperty,
}
export type {
   BasePropertyType,
   ArrayPropertyType,
   NumberPropertyType,
   BooleanPropertyType,
   DateTimePropertyType,
   EnumPropertyType,
   ObjectPropertyType,
   StringPropertyType,
   HashPropertyType,
   MapPropertyType,
   FilePropertyType,
   CollectionPropertyType,
}

type BaseType = { type: PropertyTypes }

export type DataObjectProperties = (
   | (NumberPropertyType & BaseType)
   | (BooleanPropertyType & BaseType)
   | (EnumPropertyType & BaseType)
   | (ObjectPropertyType & BaseType)
   | (StringPropertyType & BaseType)
   | (HashPropertyType & BaseType)
   | (DateTimePropertyType & BaseType)
   | (ArrayPropertyType & BaseType)
   | (MapPropertyType & BaseType)
   | (CollectionPropertyType & BaseType)
)[]
