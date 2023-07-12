import { BaseObjectCore } from './BaseObjectCore'
import { DataObjectClass } from './types/DataObjectClass'
import { DateTimeProperty, EnumProperty, ObjectProperty } from '../properties'
import { HashProperty } from '../properties/HashProperty'
import { StringProperty } from '../properties/StringProperty'
import * as htmlType from '../properties/types/PropertyHTMLType'
import { BaseObjectProperties, BaseObject } from './BaseObject'
import { Persisted } from './types/Persisted'
import { Proxy } from './types/ProxyConstructor'

export interface User extends BaseObject {
   firstname: string
   lastname: string
   gender?: 'male' | 'female' | 'nonbinary'
   birthday?: Date
   password: string
   email: string
}

/**
 * Callback function to populate the 'name' property
 * @param dao DataObject
 * @returns
 */
const onChange = (dao: DataObjectClass<any>) =>
   dao.set('name', `${dao.val('firstname')} ${dao.val('lastname')}`)

export const UserProperties: any = [
   ...BaseObjectProperties,
   {
      // change name property minLength
      name: 'name',
      type: StringProperty.TYPE,
      minLength: 0,
      fullSearch: true,
      htmlType: htmlType.NAME,
   },
   {
      name: 'firstname',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      htmlType: htmlType.GIVEN_NAME,
      onChange,
   },
   {
      name: 'lastname',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      htmlType: htmlType.FAMILY_NAME,
      onChange,
   },
   {
      name: 'gender',
      mandatory: false,
      type: EnumProperty.TYPE,
      values: ['male', 'female', 'nonbinary'],
      htmlType: htmlType.GENDER,
   },
   {
      name: 'birthday',
      mandatory: false,
      type: DateTimeProperty.TYPE,
      htmlType: htmlType.BIRTHDAY,
   },
   {
      name: 'email',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      fullSearch: true,
      htmlType: htmlType.EMAIL,
   },
   {
      name: 'password',
      mandatory: true,
      type: HashProperty.TYPE,
      algorithm: HashProperty.ALGORITHM_SHA256,
      salt: '', // you should override it in your code
      minLength: 5,
      maxLength: 20, // this is for the clear password
      htmlType: htmlType.PASSWORD,
   },
   {
      name: 'entity',
      mandatory: false,
      type: ObjectProperty.TYPE,
      instanceOf: BaseObjectCore,
   },
]

export class UserCore extends BaseObjectCore {
   static PROPS_DEFINITION = UserProperties
   static COLLECTION = 'user'

   static async factory(
      src: any = undefined
   ): Promise<Proxy<User> | Persisted<User>> {
      return super.factory(src, UserCore)
   }
}
