import { BaseObject } from './BaseObject'
import { UserProperties } from './UserProperties'
import { UserClass } from './types/UserClass'

export class User extends BaseObject implements UserClass {
   static PROPS_DEFINITION = UserProperties

   static async factory(src: any = undefined): Promise<User> {
      return super.factory(src, User)
   }
}
