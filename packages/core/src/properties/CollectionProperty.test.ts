import { Entity } from '../components/Entity'
import { User } from '../components/User'
import { CollectionProperty } from './CollectionProperty'
import { Core } from '../Core'

describe('Collection Property', () => {
   test('should throw an error if instantiated without instanceOf', () => {
      expect(() => new CollectionProperty({ name: 'users' } as any)).toThrow("Parameter 'instanceOf' is mandatory")
   })

   test('should instantiate correctly with a class constructor', () => {
      const prop = new CollectionProperty({
         name: 'users',
         instanceOf: User,
      })
      expect(prop.name).toBe('users')
   })

   test('should instantiate correctly with a string class name from Core registry', () => {
      Core.addClass('User', User)
      const prop = new CollectionProperty({
         name: 'users',
         instanceOf: 'User',
      })
      expect(prop.name).toBe('users')
   })

   test('should set and get values using set() and val()', async () => {
      const prop = new CollectionProperty({
         name: 'users',
         instanceOf: User,
      })
      const user1 = await User.factory()
      const user2 = await User.factory()
      prop.set([user1, user2])
      expect(prop.val()).toEqual([user1, user2])
   })

   test('should serialize correctly using toJSON()', async () => {
      const prop = new CollectionProperty({
         name: 'users',
         instanceOf: User,
      })
      const user1 = await User.factory()
      prop.set([user1])
      expect(prop.toJSON()).toEqual([user1])
   })

   test('Entity should have users collection property', async () => {
      const entity = await Entity.factory({ name: 'My Company' })
      const usersProp = entity.dataObject.get('users')
      expect(usersProp).toBeDefined()
      expect(usersProp.constructor.name).toBe('CollectionProperty')
   })

   test('should correctly compute composite methods (sum, average, distinct, min, max, groupBy, pluck, count)', () => {
      const prop = new CollectionProperty({
         name: 'users',
         instanceOf: User,
      })

      // We use items that mimic BaseObject's val() method
      const items = [
         { val: (p: string) => (p === 'score' ? 10 : p === 'group' ? 'A' : undefined) },
         { val: (p: string) => (p === 'score' ? 20 : p === 'group' ? 'B' : undefined) },
         { val: (p: string) => (p === 'score' ? 30 : p === 'group' ? 'A' : undefined) },
      ]

      prop.set(items)

      // sum
      expect(prop.sum('score')).toBe(60)

      // average
      expect(prop.average('score')).toBe(20)

      // distinct
      expect(prop.distinct('group').sort()).toEqual(['A', 'B'])

      // min / max
      expect(prop.min('score')).toBe(10)
      expect(prop.max('score')).toBe(30)

      // groupBy
      const grouped = prop.groupBy('group')
      expect(grouped['A'].length).toBe(2)
      expect(grouped['B'].length).toBe(1)

      // pluck
      expect(prop.pluck('score')).toEqual([10, 20, 30])

      // count
      expect(prop.count()).toBe(3)
      expect(prop.count((x) => x.val('score') > 15)).toBe(2)
   })

   test('should apply synchronous and asynchronous callbacks using apply()', async () => {
      const prop = new CollectionProperty({
         name: 'users',
         instanceOf: User,
      })

      const items = [{ id: 1 }, { id: 2 }]
      prop.set(items)

      // Sync apply
      const syncResult = prop.apply((item) => item.id * 10)
      expect(syncResult).toEqual([10, 20])

      // Async apply
      const asyncResult = await prop.apply(async (item) => {
         return Promise.resolve(item.id * 100)
      })
      expect(asyncResult).toEqual([100, 200])
   })
})


