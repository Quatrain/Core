import { Entity, User } from '@quatrain/core'
import { setup, createUsers, createEntity, createUser } from './common'

const backend = setup()

let user: User | undefined
let entity: Entity | undefined

beforeAll(async () => {
   entity = await createEntity()
   await backend.create(entity.dataObject)

   await createUsers()
   await createUsers(3, { lastname: 'Doe' })
   await createUsers(3, { entity })
   await createUsers(2, { lastname: 'Doe', entity })
})

afterAll(async () => {
   // Remove collections after each test
   await Promise.all([
      backend.deleteCollection('user'),
      backend.deleteCollection('entity'),
   ])
})

describe('Firestore find() operations', () => {
   test('find all entities records', async () => {
      const res = await Entity.query().execute()
      expect(res.items.length).toBe(1)
   })

   test('find records with filter on string property', async () => {
      // Query users named Doe
      const res = await User.query().where('lastname', 'Doe').execute()

      expect(res.items.length).toBe(5)
   })

   test('find records with filter on object property', () => {
      User.query()
         .where('entity', entity)
         .execute()
         .then(({ items }) => expect(items.length).toBe(5))
   })

   test('find records with filters on string and object properties', () => {
      // Query users in entity Acme Inc.
      User.query()
         .where('lastname', 'Doe')
         .where('entity', entity)
         .execute()
         .then(({ items }) => expect(items.length).toBe(2))
   })

   test('find users records within batch limit', async () => {
      // Query all users without a batch value
      const query = User.query()
      const { items } = await query.execute()
      expect(items.length).toBe(10)
   })

   test('find all users records', () => {
      // Query all users without a batch value
      User.query()
         .batch(-1)
         .execute()
         .then(({ items }) => expect(items.length).toBe(13))
   })
})
