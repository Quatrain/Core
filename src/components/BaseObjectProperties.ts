import * as statuses from '../statuses'
import { UserClass } from './types/UserClass'
import { ObjectUri } from './ObjectUri'
//import { DataObjectProperties } from '../properties'
import { StringProperty } from '../properties/StringProperty'
import { ObjectProperty } from '../properties/ObjectProperty'
import { EnumProperty } from '../properties/EnumProperty'
import { DateTimeProperty } from '../properties/DateTimeProperty'

export interface BaseObjectType {
   name: string
   status:
      | typeof statuses.CREATED
      | typeof statuses.PENDING
      | typeof statuses.ACTIVE
      | typeof statuses.DELETED
   createdBy?: UserClass | ObjectUri
   createdAt?: number
   updatedBy?: UserClass | ObjectUri
   updatedAt?: number
   deletedBy?: UserClass | ObjectUri
   deletedAt?: number
}

export const BaseObjectProperties: any = [
   {
      name: 'name',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
   },
   {
      name: 'status',
      mandatory: true,
      type: EnumProperty.TYPE,
      values: [
         statuses.CREATED,
         statuses.PENDING,
         statuses.ACTIVE,
         statuses.DELETED,
      ],
      defaultValue: statuses.CREATED,
   },
   {
      name: 'createdBy',
      type: ObjectProperty.TYPE,
      instanceOf: 'User',
      mandatory: true,
      protected: true,
   },
   {
      name: 'createdAt',
      type: DateTimeProperty.TYPE,
      mandatory: true,
      protected: true,
   },
   {
      name: 'updatedBy',
      type: ObjectProperty.TYPE,
      instanceOf: 'User',
   },
   {
      name: 'updatedAt',
      type: DateTimeProperty.TYPE,
   },
   {
      name: 'deletedBy',
      type: ObjectProperty.TYPE,
      instanceOf: 'User',
      protected: true,
   },
   {
      name: 'deletedAt',
      type: DateTimeProperty.TYPE,
      protected: true,
   },
]
