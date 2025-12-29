import { PersistedDataObject } from './PersistedDataObject'
import { Backend } from './Backend'
import { MockAdapter } from './MockAdapter'
import { StringProperty } from '@quatrain/core'

describe('PersistedDataObject', () => {
   beforeAll(() => {
      Backend.addBackend(new MockAdapter(), 'default', true)
   })

   beforeEach(() => {
      // Clear mock storage
      const fixtures = MockAdapter.getFixtures()
      for (const key in fixtures) {
         delete fixtures[key]
      }
   })

   it('should manage persistence state and reset change flags', () => {
      const dao = PersistedDataObject.factory({
         properties: [{ name: 'name', type: StringProperty.TYPE }],
      })
      dao.set('name', 'changed')
      expect(dao.isPersisted()).toBe(false)
      expect(dao.get('name').hasChanged).toBe(true)

      dao.isPersisted(true)
      expect(dao.isPersisted()).toBe(true)
      expect(dao.get('name').hasChanged).toBe(false)
   })

   it('should delegate save to backend create for new objects', async () => {
      const dao = PersistedDataObject.factory({
         properties: [{ name: 'name', type: StringProperty.TYPE }],
      })
      dao.uri.collection = 'items'
      dao.set('name', 'New Item')

      await dao.save()
      expect(dao.uid).toBeDefined()
      expect(MockAdapter.getFixture(dao.path)).toBeDefined()
      expect(MockAdapter.getFixture(dao.path).name).toBe('New Item')
   })

   it('should delegate save to backend update for existing objects', async () => {
      const path = 'items/123'
      MockAdapter.inject({ path, name: 'Old Name' } as any)

      const dao = PersistedDataObject.factory({
         properties: [{ name: 'name', type: StringProperty.TYPE }],
         uri: path,
      })
      await dao.read()
      dao.set('name', 'Updated Name')

      await dao.save()
      expect(MockAdapter.getFixture(path).name).toBe('Updated Name')
   })

   it('should populate data from a raw object', async () => {
      const dao = PersistedDataObject.factory({
         properties: [{ name: 'name', type: StringProperty.TYPE }],
      })
      await dao.populate({ name: 'Populated' })
      expect(dao.val('name')).toBe('Populated')
   })

   it('should handle deletion', async () => {
      const path = 'items/to-delete'
      MockAdapter.inject({ path, name: 'Delete Me' } as any)
      const dao = PersistedDataObject.factory({
         uri: path,
         properties: [{ name: 'name', type: StringProperty.TYPE }],
      })

      await dao.delete()
      expect(MockAdapter.getFixture(path)).toBeUndefined()
      expect(dao.isPersisted()).toBe(false)
   })
})
