import { Filter, Limits, SortAndLimit, Sorting, User } from '@quatrain/backend'
import { setup } from './common'

const backend = setup()
let template: User

const names = (result: { items: any[] }) => result.items.map((item) => item.val('firstname'))
const find = (filters: Filter[], pagination?: SortAndLimit) =>
   backend.find(template.dataObject, filters, pagination ?? new SortAndLimit([new Sorting('firstname')], new Limits(0, 50)))

beforeAll(async () => {
   await backend.deleteCollection('user')
   template = await User.factory()
   const people = [
      ['Ada', 'Doe', 'ada@example.org'],
      ['Bob', 'Doe', 'bob@example.org'],
      ['Cid', "O'Roe", 'cid@example.org'],
   ]
   for (const [firstname, lastname, email] of people) {
      const user = await User.factory()
      user._.firstname = firstname
      user._.lastname = lastname
      user._.email = email
      user._.password = 'password'
      await user.save()
   }
})

afterAll(async () => {
   await backend.deleteCollection('user')
})

describe('Postgres find()', () => {
   test('filters, sorts and limits', async () => {
      expect(names(await find([new Filter('lastname', 'Doe')]))).toEqual(['Ada', 'Bob'])
      expect(names(await find([new Filter('lastname', 'Doe', 'notEquals')]))).toEqual(['Cid'])
      expect(names(await find([new Filter('email', 'BOB@', 'like')]))).toEqual(['Bob'])
      expect(names(await find([new Filter('firstname', ['Ada', 'Cid'], 'contains')]))).toEqual(['Ada', 'Cid'])
      expect(names(await find([new Filter('lastname', 'Doe'), new Filter('firstname', 'Bob')]))).toEqual(['Bob'])
      expect(names(await find([new Filter('keywords', 'example.org')]))).toEqual(['Ada', 'Bob', 'Cid'])
      const page = await find([], new SortAndLimit([new Sorting('firstname', 'desc')], new Limits(1, 1)))
      expect(names(page)).toEqual(['Bob'])
      expect(page.meta.count).toBe(3)
   })

   test('matches values holding quotes instead of breaking the query', async () => {
      expect(names(await find([new Filter('lastname', "O'Roe")]))).toEqual(['Cid'])
   })

   test('treats filter values as data, not SQL', async () => {
      expect(names(await find([new Filter('lastname', "Doe' OR '1'='1")]))).toEqual([])
      expect(names(await find([new Filter('lastname', `x'; DELETE FROM "user"; --`)]))).toEqual([])
      expect(names(await find([new Filter('firstname', ["Ada') OR ('1'='1"], 'contains')]))).toEqual([])
      expect(names(await find([new Filter('keywords', "zzz' OR '1'='1")]))).toEqual([])
      expect(names(await find([]))).toEqual(['Ada', 'Bob', 'Cid'])
   })

   test('refuses SQL in sortings, limits and sub-property filters', async () => {
      const sortedBy = (prop: string, order = 'asc') => find([], new SortAndLimit([new Sorting(prop, order as never)], new Limits(0, 10)))
      await expect(sortedBy('firstname; DELETE FROM "user"')).rejects.toThrow(/Invalid sorting/)
      await expect(sortedBy('firstname', 'asc; DELETE FROM "user"')).rejects.toThrow(/Invalid sorting/)
      await expect(find([], new SortAndLimit([], new Limits(0, '1; DELETE FROM "user"' as never)))).rejects.toThrow(/Invalid limits/)
      await expect(find([new Filter('entity.name = name OR entity_table.name', 'x')])).rejects.toThrow(/Invalid sub-property/)
      expect(names(await find([]))).toEqual(['Ada', 'Bob', 'Cid'])
   })
})
