import { Core } from './Core'
import * as statuses from './common/statuses'
import { Property } from './properties/Property'
import { BaseProperty, BasePropertyType } from './properties/BaseProperty'
import { StringProperty, StringPropertyType } from './properties/StringProperty'
import { NumberProperty, NumberPropertyType } from './properties/NumberProperty'
import { EnumProperty, EnumPropertyType } from './properties/EnumProperty'
import {
   BooleanProperty,
   BooleanPropertyType,
} from './properties/BooleanProperty'
import {
   ObjectProperty,
   ObjectPropertyType,
   returnAs,
} from './properties/ObjectProperty'
import {
   DateTimeProperty,
   DateTimePropertyType,
} from './properties/DateTimeProperty'
import { HashProperty, HashPropertyType } from './properties/HashProperty'
import {
   CollectionProperty,
   CollectionPropertyType,
} from './properties/CollectionProperty'
import { ArrayProperty, ArrayPropertyType } from './properties/ArrayProperty'
import { AbstractObject } from './components/AbstractObject'
import { ObjectUri } from './components/ObjectUri'
import { DataObjectClass } from './components/types/DataObjectClass'
import { DataObject } from './components/DataObject'
import { DataObjectProperties } from './properties'
import { BaseObject } from './components/BaseObject'
import { BaseObjectProperties } from './components/BaseObjectProperties'
import { BaseObjectType } from './components/types/BaseObjectType'
import { Proxy } from './components/types/ProxyConstructor'

import { UserType, User, UserProperties } from './components/User'
import { EntityType, Entity } from './components/Entity'

import {
   BadRequestError,
   UnauthorizedError,
   ForbiddenError,
   NotFoundError,
   GoneError,
} from './common/ResourcesErrors'
import { DataObjectParams } from './components/types/DataObjectParams'

export {
   statuses,
   Core,
   Property,
   BaseProperty,
   BooleanProperty,
   DateTimeProperty,
   EnumProperty,
   HashProperty,
   CollectionProperty,
   ArrayProperty,
   ObjectProperty,
   NumberProperty,
   returnAs,
   StringProperty,
   ObjectUri,
   DataObject,
   AbstractObject,
   BaseObject,
   BaseObjectProperties,
   User,
   UserProperties,
   Entity,
   BadRequestError,
   UnauthorizedError,
   ForbiddenError,
   NotFoundError,
   GoneError,
}

export type {
   BasePropertyType,
   BooleanPropertyType,
   DataObjectParams,
   DateTimePropertyType,
   EnumPropertyType,
   HashPropertyType,
   CollectionPropertyType,
   ArrayPropertyType,
   ObjectPropertyType,
   NumberPropertyType,
   StringPropertyType,
   DataObjectClass,
   DataObjectProperties,
   BaseObjectType,
   UserType,
   Proxy,
   EntityType,
}
