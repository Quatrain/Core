import { BaseObject } from '../BaseObject'
import { Core, statuses } from '../..'
import { MockAdapter } from '../../backends'
import {
   BaseObjectData,
   baseObjectUri,
   UserData,
   UserUri,
} from './fixtures/dao'
import { User } from '../User'

MockAdapter.inject(BaseObjectData) // sets default to @mock
MockAdapter.inject(UserData)

describe('Base object', () => {
   test('has name, status and createdBy properties that are instances', () =>
      BaseObject.factory().then((obj) => {
         expect(obj.get('name').constructor.name).toBe('StringProperty')
         expect(obj.get('status').constructor.name).toBe('EnumProperty')
         expect(obj.get('createdBy').constructor.name).toBe('ObjectProperty')
         expect(obj.get('createdAt').constructor.name).toBe('DateTimeProperty')
      }))
})

describe('User object', () => {
   test('can be loaded from backend', () => {
      User.factory(UserUri)
         .then((user: User) => {
            expect(user.val('name')).toEqual('John Doe')
            expect(user.val('status')).toEqual(statuses.ACTIVE)
            expect(user.val('createdBy')).toEqual(user.toJSON())
            expect(user.val('createdAt')).toEqual(1)
         })
         .catch((e) => console.log(e))
   })

   test('can be persisted in backend', () => {
      User.factory(UserUri)
         .then((existingUser: User) => {
            Core.getBackend('@mock').setParam('injectMeta', true)
            Core.currentUser = existingUser
            User.factory()
               .then((user: User) => {
                  expect(user.uid).toBeUndefined()
                  user.set('name', 'Jane Doe')
                  user.save().then(() => {
                     expect(user.uid).not.toBeUndefined()
                     expect(user.val('name')).toEqual('Jane Doe')
                     expect(user.val('status')).toEqual(statuses.CREATED)
                     expect(user.val('createdBy')).toBe(existingUser)
                  })
               })
               .catch((e) => console.log(e))
         })
         .catch((e) => console.log(e))
         .catch((e) => console.log(e))
   })
})
