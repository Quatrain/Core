import { User } from '../User'
import { statuses } from '../..'
import { MockAdapter } from '../../backends'
import { UserData, UserUri } from './fixtures/dao'

MockAdapter.inject(UserData) // sets default to @mock

describe('User object', () => {
   test('has 5 properties that are instances', () =>
      User.factory().then((obj) => {
         expect(Object.keys(obj.dataObject.properties)).toHaveLength(7)
         expect(obj.get('firstname').constructor.name).toBe('StringProperty')
         expect(obj.get('lastname').constructor.name).toBe('StringProperty')
         expect(obj.get('email').constructor.name).toBe('StringProperty')
         expect(obj.get('password').constructor.name).toBe('HashProperty')
      }))

   test('can be persisted in backend', () => {
      User.factory()
         .then((obj) => {
            expect(obj.uid).toBeUndefined()
            obj.set('name', 'a name')
            obj.save().then(() => {
               expect(obj.uid).not.toBeUndefined()
               expect(obj.val('name')).toEqual('a name')
               expect(obj.val('status')).toEqual(statuses.ACTIVE)
            })
         })
         .catch((e) => console.log(e))
   })

   test('can be populated with data from backend', () => {
      User.factory(UserUri)
         .then((obj) => {
            expect(obj.val('name')).toEqual('John Doe')
            expect(obj.val('status')).toEqual(statuses.ACTIVE)
         })
         .catch((e) => console.log(e))
   })
})
