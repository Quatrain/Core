import { Property } from '../properties/Property'
import { DataObjectProperties } from '../properties'
import * as statuses from '../statuses'
import { User } from './User'
import { ObjectUri } from './ObjectUri'
import { Status } from '../common/statuses'

export interface BaseObjectType {
   name: string
   status: Status
   createdBy?: User | ObjectUri
   createdAt?: number
   updatedBy?: User | ObjectUri
   updatedAt?: number
   deletedBy?: User | ObjectUri
   deletedAt?: number
}

export const BaseObjectProperties: DataObjectProperties = [
   {
      name: 'name',
      mandatory: true,
      type: Property.TYPE_STRING,
      minLength: 1,
      maxLength: 100,
   },
   {
      name: 'status',
      mandatory: true,
      type: Property.TYPE_ENUM,
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
      type: Property.TYPE_OBJECT,
      instanceOf: 'User',
      mandatory: true,
      protected: true,
   },
   {
      name: 'createdAt',
      type: Property.TYPE_DATETIME,
      mandatory: true,
      protected: true,
   },
   {
      name: 'updatedBy',
      type: Property.TYPE_OBJECT,
      instanceOf: 'User',
   },
   {
      name: 'updatedAt',
      type: Property.TYPE_DATETIME,
   },
   {
      name: 'deletedBy',
      type: Property.TYPE_OBJECT,
      instanceOf: 'User',
      protected: true,
   },
   {
      name: 'deletedAt',
      type: Property.TYPE_DATETIME,
      protected: true,
   },
]
