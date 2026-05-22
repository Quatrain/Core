import { AbstractObject } from './AbstractObject'
import { Backend } from './Backend'
import { MockAdapter } from './MockAdapter'
import { StringProperty } from '@quatrain/core'
import { PersistedDataObject } from './PersistedDataObject'

/**
 * Test class to test AbstractObject functionality.
 */
class TestAbstractObject extends AbstractObject {
   static COLLECTION = 'test_abstract'
   static PROPS_DEFINITION = [{ name: 'name', type: StringProperty.TYPE }]
}

describe('AbstractObject (Backend)', () => {
   let dao: any
   let obj: TestAbstractObject

   beforeAll(() => {
      Backend.addBackend(new MockAdapter(), 'default', true)
   })

   beforeEach(() => {
      dao = PersistedDataObject.factory({
         properties: [{ name: 'name', type: StringProperty.TYPE }],
      })
      obj = new TestAbstractObject(dao)
   })

   it('should delegate basic property operations to DataObject', () => {
      obj.set('name', 'Hello')
      expect(obj.get('name')).toBeDefined()
      expect(obj.val('name')).toBe('Hello')
      expect(obj.has('name')).toBe(true)
      expect(obj.has('non_existent')).toBe(false)
      
      expect(() => obj.val('non_existent')).toThrow("No property matching key 'non_existent'")
   })

   it('should throw if get returns falsy without throwing', () => {
      const getSpy = jest.spyOn(obj, 'get').mockReturnValue(null as any)
      expect(() => obj.val('some_key')).toThrow("some_key is not a valid property")
      getSpy.mockRestore()
   })

   it('should access internal getters correctly', () => {
      obj.set('name', 'Getter Test')
      obj.dataObject.uri.path = 'test_abstract/my-uid'
      
      expect(obj.path).toBe('test_abstract/my-uid')
      expect(obj.uid).toBe('my-uid')
      expect(obj.dataObject).toBe(dao)
      expect(obj._).toBeDefined()
      expect(obj.uri).toBeDefined()
      expect(obj.backend).toBeUndefined()
      
      const uriStr = typeof obj.uri === 'string' ? obj.uri : obj.uri?.toJSON()
      expect(obj.toJSON()).toEqual(uriStr)
   })

   it('should serialize correctly when uri is a string', () => {
      const uriSpy = jest.spyOn(obj, 'uri', 'get').mockReturnValue('string-uri')
      expect(obj.toJSON()).toBe('string-uri')
      uriSpy.mockRestore()
   })

   it('should save and delete using underlying dataObject methods', async () => {
      const saveSpy = jest.spyOn(dao, 'save').mockImplementation(async () => dao)
      const deleteSpy = jest.spyOn(dao, 'delete').mockImplementation(async () => dao)

      const saved = await obj.save()
      expect(saveSpy).toHaveBeenCalled()
      expect(saved).toBe(obj)

      const deleted = await obj.delete()
      expect(deleteSpy).toHaveBeenCalled()
      expect(deleted).toBe(dao)

      saveSpy.mockRestore()
      deleteSpy.mockRestore()
   })
})
