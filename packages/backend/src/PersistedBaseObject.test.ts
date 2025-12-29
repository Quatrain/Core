import { PersistedBaseObject } from './PersistedBaseObject'
import { Backend } from './Backend'
import { MockAdapter } from './MockAdapter'
import { statuses, StringProperty } from '@quatrain/core'
import { Query } from './Query'

class TestObject extends PersistedBaseObject {
   static COLLECTION = 'test'
   static PROPS_DEFINITION = [{ name: 'name', type: StringProperty.TYPE }]
}

describe('PersistedBaseObject', () => {
   beforeAll(() => {
      Backend.addBackend(new MockAdapter(), 'default', true)
   })

   it('should instantiate via factory and initialize DAO', async () => {
      const obj = await TestObject.factory()
      expect(obj).toBeInstanceOf(TestObject)
      expect(obj.dataObject).toBeDefined()
      expect(obj.dataObject.uri.collection).toBe('test')
   })

   it('should create an instance from a plain object', () => {
      const data = { name: 'Instance Name', status: statuses.CREATED }
      const obj = TestObject.fromObject(data)
      expect(obj).toBeInstanceOf(TestObject)
      expect(obj.val('name')).toBe('Instance Name')
   })

   it('should delegate save and delete to the underlying DAO', async () => {
      const obj = await TestObject.factory()
      obj.set('name', 'Save Test')

      const saveSpy = jest.spyOn(obj.dataObject, 'save')
      await obj.save()
      expect(saveSpy).toHaveBeenCalled()

      const deleteSpy = jest.spyOn(obj.dataObject, 'delete')
      await obj.delete()
      expect(deleteSpy).toHaveBeenCalled()
   })

   it('should provide a query builder for the class', () => {
      const query = TestObject.query()
      expect(query).toBeInstanceOf(Query)
      expect(query.obj).toBe(TestObject)
   })

   it('should correctly merge property definitions', () => {
      class ExtendedObject extends TestObject {
         static PROPS_DEFINITION = [
            { name: 'extra', type: StringProperty.TYPE },
         ]
      }

      const dao = ExtendedObject.fillProperties(ExtendedObject)
      // Should have 'name' from TestObject and 'extra' from ExtendedObject
      // Plus base properties like 'id', 'status' from BaseObject
      expect(dao.has('name')).toBe(true)
      expect(dao.has('extra')).toBe(true)
   })
})
