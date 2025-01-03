import * as statuses from '../common/statuses'
import { StringProperty } from '../properties/StringProperty'
import { ObjectProperty } from '../properties/ObjectProperty'
import { EnumProperty } from '../properties/EnumProperty'
import { DateTimeProperty } from '../properties/DateTimeProperty'
import * as htmlType from '../properties/types/PropertyHTMLType'

export const BaseObjectProperties: any = [
   {
      name: 'name',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      fullSearch: true,
      htmlType: htmlType.NAME,
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
   // the following properties may be optionally
   // populated with a backend middleware
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
      instanceOf: 'User',
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
      instanceOf: 'User',
   },
]
