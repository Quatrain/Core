import { User, PersistedBaseObject } from '@quatrain/backend'
import { Entity as CoreEntity } from '@quatrain/core'

export class Entity extends PersistedBaseObject {
   static COLLECTION = 'entities'
   static PROPS_DEFINITION = CoreEntity.PROPS_DEFINITION

   static async factory(src: any = undefined): Promise<Entity> {
      return super.factory(src, Entity)
   }
}

export const createUser = async () => {
   const user = await User.factory()
   user._.firstname = 'John'
   user._.lastname = 'Doe'
   user._.email = 'john@doe.com'
   user._.password = 'password123' // or 'azerty' depending on backend tests, but let's stick to a common one

   return user
}

export const createEntity = async () => {
   const entity = await Entity.factory()
   entity._.name = 'ACME Inc.'

   return entity
}

export const createUsers = async (
   userModel: User,
   qty: number = 5,
   forcedValues: any = {}
): Promise<User[]> => {
   const users: User[] = []
   for (let i = 0; i < qty; i++) {
      const user = await User.factory()
      user._.firstname = forcedValues.firstname || `User${i}`
      user._.lastname = forcedValues.lastname || 'Test'
      user._.email = forcedValues.email || `user${i}@test.com`
      user._.password = forcedValues.password || 'password'
      if (forcedValues.entity) {
         user._.entity = forcedValues.entity
      }
      users.push(user)
   }
   return users
}
