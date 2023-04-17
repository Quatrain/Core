import * as statuses from '../../../statuses'
import { DataObjectProperties } from '../../../properties'
import { Property } from '../../../properties/Property'
import { User } from '../../User'
import { BaseObject } from '../../BaseObject'
import { ObjectUri } from '../../ObjectUri'

export const fClassProperties: DataObjectProperties = [
   {
      name: 'a',
      type: Property.TYPE_STRING,
   },
]
export class fClass extends BaseObject {
   static PROPS_DEFINITION: DataObjectProperties = fClassProperties
}

export const properties: DataObjectProperties = [
   {
      name: 'string',
      mandatory: true,
      type: Property.TYPE_STRING,
      defaultValue: 'nothing',
   },
   {
      name: 'boolean',
      type: Property.TYPE_BOOLEAN,
      defaultValue: false,
   },
   {
      name: 'enum',
      type: Property.TYPE_ENUM,
      values: ['Mr', 'Miss', 'Ms', 'Dr'],
   },
   {
      name: 'object',
      type: Property.TYPE_OBJECT,
      instanceOf: fClass.prototype,
   },
]

export const fData = {
   uid: 'a/b',
   string: 'a string',
   boolean: true,
   enum: 'Miss',
   object: new ObjectUri('c/d'),
}

export const baseObjectUri = 'baseobject/xyz'
export const UserUri = 'users/abc'

export const BaseObjectData = {
   uid: baseObjectUri,
   name: 'a simple object',
   status: statuses.PENDING,
}

export const UserData = {
   uid: UserUri,
   name: 'John Doe',
   status: statuses.ACTIVE,
   firstname: 'John',
   lastname: 'Doe',
   email: 'john@doe.com',
   password: 'f2d81a260dea8a100dd517984e53c56a7523d96942a834b9cdc249bd4e8c7aa9',
   createdBy: { label: 'John Doe', ref: UserUri, backend: '@mock' },
   createdAt: 1,
}
