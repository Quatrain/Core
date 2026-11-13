import { BaseObjectProperties, ConflictError, StringProperty } from '@quatrain/core'
import { MockAdapter } from './MockAdapter'
import { PersistedBaseObject } from './PersistedBaseObject'
import { UniqueConstraintError, uniquePropertyNames } from './UniqueConstraintError'

class Space extends PersistedBaseObject {
   static COLLECTION = 'spaces'
   static PROPS_DEFINITION = [
      ...BaseObjectProperties,
      { name: 'slug', type: StringProperty.TYPE, unique: true },
      { name: 'label', type: StringProperty.TYPE },
   ]
}

class Other extends PersistedBaseObject {
   static COLLECTION = 'others'
   static PROPS_DEFINITION = [...BaseObjectProperties, { name: 'slug', type: StringProperty.TYPE, unique: true }]
}

describe('unique properties', () => {
   let adapter: MockAdapter

   beforeEach(() => {
      adapter = new MockAdapter()
      const fixtures = MockAdapter.getFixtures()
      for (const key in fixtures) {
         delete fixtures[key]
      }
   })

   it('lists the properties declared unique', () => {
      expect(uniquePropertyNames(Space.fromObject({ name: 'A', slug: 'a' }).dataObject)).toEqual(['slug'])
   })

   it('refuses a second record with the same value', async () => {
      await adapter.create(Space.fromObject({ name: 'Acme', slug: 'acme', label: 'x' }).dataObject)
      const duplicate = adapter.create(Space.fromObject({ name: 'Other', slug: 'acme', label: 'x' }).dataObject)
      await expect(duplicate).rejects.toBeInstanceOf(UniqueConstraintError)
      await expect(duplicate).rejects.toBeInstanceOf(ConflictError)
      await expect(duplicate).rejects.toMatchObject({ collection: 'spaces', property: 'slug' })
   })

   it('lets non-unique properties, missing values and other collections repeat', async () => {
      await adapter.create(Space.fromObject({ name: 'Acme', slug: 'acme', label: 'same' }).dataObject)
      await adapter.create(Space.fromObject({ name: 'Globex', slug: 'globex', label: 'same' }).dataObject)
      await adapter.create(Space.fromObject({ name: 'No slug 1' }).dataObject)
      await adapter.create(Space.fromObject({ name: 'No slug 2' }).dataObject)
      await adapter.create(Other.fromObject({ name: 'Acme', slug: 'acme' }).dataObject)
      expect(Object.keys(MockAdapter.getFixtures())).toHaveLength(5)
   })

   it('refuses an update taking the value of another record, but not its own', async () => {
      const acme = await adapter.create(Space.fromObject({ name: 'Acme', slug: 'acme' }).dataObject)
      const globex = await adapter.create(Space.fromObject({ name: 'Globex', slug: 'globex' }).dataObject)
      globex.set('slug', 'acme')
      await expect(adapter.update(globex)).rejects.toBeInstanceOf(UniqueConstraintError)
      acme.set('label', 'renamed')
      await expect(adapter.update(acme)).resolves.toBeDefined()
   })
})
