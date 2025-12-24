import { DataObjectClass } from '../components/types/DataObjectClass'
import { BaseProperty } from './BaseProperty'
import { BooleanProperty, BooleanPropertyType } from './BooleanProperty'
import { DateTimeProperty, DateTimePropertyType } from './DateTimeProperty'
import { EnumProperty, EnumPropertyType } from './EnumProperty'
import { HashProperty, HashPropertyType } from './HashProperty'
import { StringProperty, StringPropertyType } from './StringProperty'
import { NumberProperty, NumberPropertyType } from './NumberProperty'
import { ObjectProperty, ObjectPropertyType } from './ObjectProperty'
import { CollectionProperty } from './CollectionProperty'
import { ArrayProperty } from './ArrayProperty'
import { MapProperty } from './MapProperty'
import { FileProperty, FilePropertyType } from './FileProperty'

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
   static TYPE_MAP = 'map'
   static TYPE_FILE = 'file'

   static factory(
      params: ObjectPropertyType &
         StringPropertyType &
         NumberPropertyType &
         EnumPropertyType &
         BooleanPropertyType &
         HashPropertyType &
         DateTimePropertyType &
         FilePropertyType,
      parent: DataObjectClass<any>
   ) {
      params.parent = parent
      switch (params.type) {
         case BaseProperty.TYPE:
            return new BaseProperty(params)

         case StringProperty.TYPE:
            return new StringProperty(params)

         case NumberProperty.TYPE:
            return new NumberProperty(params)

         case ObjectProperty.TYPE:
            return new ObjectProperty(params)

         case EnumProperty.TYPE:
            return new EnumProperty(params)

         case BooleanProperty.TYPE:
            return new BooleanProperty(params)

         case HashProperty.TYPE:
            return new HashProperty(params)

         case DateTimeProperty.TYPE:
            return new DateTimeProperty(params)

         case CollectionProperty.TYPE:
            if (!('instanceOf' in params)) {
               throw new Error('Missing property instanceOf!')
            }

            return new CollectionProperty(params as any)

         case ArrayProperty.TYPE:
            return new ArrayProperty(params)

         case MapProperty.TYPE:
            return new MapProperty(params)

         case FileProperty.TYPE:
            return new FileProperty(params)

         default:
            throw new Error(`Unknown property type ${params.type}`)
      }
   }
}
