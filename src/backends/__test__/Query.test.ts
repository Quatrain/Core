import { DataObject, ObjectUri, User } from '../../components'
import { Query } from '../../backends'
import { UserDataGenerator } from './fixtures/Generators'
import { returnAs } from '../Query'

const MEMBERS = 5

// Generate data of fake users on mock adapter
UserDataGenerator(MEMBERS)

describe('Test Query object', () => {
   test('A simple query', () => {
      User.factory().then((user) => {
         const query = new Query(user)
         query.execute().then((value) => {
            expect(value).toBeInstanceOf(Array)
            expect(value.length).toBe(MEMBERS)
            expect(value[0]).toBeInstanceOf(DataObject)
         })
      })
   })

   test('return object uris', () => {
      User.factory().then((user) => {
         const query = new Query(user)
         query.execute(returnAs.AS_OBJECTURIS).then((value) => {
            expect(value).toBeInstanceOf(Array)
            expect(value.length).toBe(MEMBERS)
            expect(value[0]).toBeInstanceOf(ObjectUri)
         })
      })
   })

   test.only('return object instances', () => {
      User.factory().then((user) => {
         const query = new Query(Reflect.getPrototypeOf(user))
         query.execute(returnAs.AS_INSTANCES).then((value) => {
            expect(value).toBeInstanceOf(Array)
            expect(value.length).toBe(MEMBERS)
            expect(value[0]).toBeInstanceOf(User)
         })
      })
   })
})
