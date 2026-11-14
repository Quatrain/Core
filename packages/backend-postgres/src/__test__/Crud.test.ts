import { User } from '@quatrain/backend'
import { createUser, setup } from './common'

const backend = setup()
let user: User

beforeAll(async () => {
   user = (await createUser()) as User
   await user.save()
})

afterAll(async () => {
   await backend.deleteCollection('user')
   //await backend.deleteCollection('entity')
})

describe('Postgres CRUD operations', () => {
   test('write data', async () => {
      // Check that object is successfully created in backend
      expect(user.dataObject.isPersisted(false)).toBe(true)
      expect(user.uri).not.toBeUndefined()
      expect(user.uid).not.toBeUndefined()
      expect(user.uri.constructor.name).toBe('ObjectUri')
   })

   test('read data', async () => {
      // Retrieve user from empty object and record path
      const user2 = await User.factory()
      user2.dataObject.uri.path = user.dataObject.uri.path

      await backend.read(user2.dataObject)
      expect(user2._.name).toBe(user._.name)
   })

   test('update data', async () => {
      user._.firstname = 'Jane'
      await user.save()

      // Retrieve user from empty object and record path
      const user2 = await User.factory()
      user2.dataObject.uri.path = user.dataObject.uri.path

      await backend.read(user2.dataObject)
      expect(user2._.name).toBe(user._.name)
   })

   test('update treats the record identifier as data, not SQL', async () => {
      const before = user._.firstname
      const forged = await User.factory()
      forged.dataObject.uri.path = `user/x' OR '1'='1`
      forged._.firstname = 'Overwritten'

      await backend.update(forged.dataObject)

      const check = await User.factory()
      check.dataObject.uri.path = user.dataObject.uri.path
      await backend.read(check.dataObject)
      expect(check._.firstname).toBe(before)
   })

   test('delete data', async () => {
      expect(user.uid).toBeDefined()

      await backend.delete(user.dataObject)
      expect(user.uid).toBeUndefined()
   })
})
