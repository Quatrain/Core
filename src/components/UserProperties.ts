import { HashProperty } from '../properties/HashProperty'
import { StringProperty } from '../properties/StringProperty'
import { DataObjectClass } from './types/DataObjectClass'

/**
 * Callback function to populate the 'name' property
 * @param dao DataObject
 * @returns
 */
const onChange = (dao: DataObjectClass) =>
   dao.set('name', `${dao.val('firstname')} ${dao.val('lastname')}`)

export const UserProperties: any = [
   {
      // change name property minLength
      name: 'name',
      type: StringProperty.TYPE,
      minLength: 0,
   },
   {
      name: 'firstname',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      onChange,
   },
   {
      name: 'lastname',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
      onChange,
   },
   {
      name: 'email',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 100,
   },
   {
      name: 'password',
      mandatory: true,
      type: HashProperty.TYPE,
      algorithm: HashProperty.ALGORITHM_SHA256,
      salt: '', // you should override it in your code
      minLength: 5,
      maxLength: 20, // this is for the clear password
   },
]
