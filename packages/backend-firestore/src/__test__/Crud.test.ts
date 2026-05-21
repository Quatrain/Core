import { DataObject } from '@quatrain/core'
import { User } from '@quatrain/backend'
import { createUser, setup } from './common'
import { fAlert } from './fixtures/fAlert'

const backend = setup()
jest.setTimeout(15000)

let user: User
let fUserAlert: fAlert

beforeAll(async () => {
   user = await createUser()
   await user.save()

   fUserAlert = await fAlert.factory({
      name: 'user alert',
      user: user.uri,
   })

   await fUserAlert.save()
})

afterAll(async () => {
   await backend.deleteCollection('user')
})

describe('Firestore CRUD operations on a collection', () => {
   test('write data', async () => {
      // Check that object is successfully created in backend
      expect(user.dataObject.isPersisted()).toBe(true)
      expect(user.uri).not.toBeUndefined()
      expect(user.uid).not.toBeUndefined()
      expect(user.uri.constructor.name).toBe('ObjectUri')
   })

   test('read data', async () => {
      // Retrieve user from empty object and record path
      const user2 = DataObject.factory({
         uri: user.uri,
         properties: User.PROPS_DEFINITION,
      })

      await backend.read(user2)
      expect(user2.val('name')).toBe(user.val('name'))
   })

   test('update data', async () => {
      user.set('firstname', 'Jane')
      await user.save()

      const user2 = DataObject.factory({
         uri: user.uri,
         properties: User.PROPS_DEFINITION,
      })

      await backend.read(user2)
      expect(user2.val('firstname')).toBe(user.val('firstname'))
   })

   test('delete data', async () => {
      expect(user.uid).toBeDefined()

      await backend.delete(user.dataObject)
      expect(user.uid).toBeUndefined()
   })
})

describe('Firestore CRUD operations on a subCollection', () => {
   test('write data', async () => {
      // Check that object is successfully created in backend
      expect(fUserAlert.dataObject.isPersisted()).toBe(true)
      expect(fUserAlert.uri).not.toBeUndefined()
      expect(fUserAlert.uid).not.toBeUndefined()
      expect(fUserAlert.uri.constructor.name).toBe('ObjectUri')
   })

   test('read data', async () => {
      // Retrieve user from empty object and record path
      const fUserAlert2 = DataObject.factory({
         uri: fUserAlert.uri,
         properties: fAlert.PROPS_DEFINITION,
      })

      await backend.read(fUserAlert2)
      expect(fUserAlert2.val('name')).toBe(fUserAlert.val('name'))
   })

   test('update data', async () => {
      fUserAlert.set('name', 'alert for a user')
      await fUserAlert.save()

      const fUserAlert2 = DataObject.factory({
         uri: fUserAlert.uri,
         properties: fAlert.PROPS_DEFINITION,
      })

      await backend.read(fUserAlert2)
      expect(fUserAlert2.val('name')).toBe(fUserAlert.val('name'))
   })

   test('delete data', async () => {
      expect(fUserAlert.uid).toBeDefined()

      await backend.delete(fUserAlert.dataObject)
      expect(fUserAlert.uid).toBeUndefined()
   })
})
