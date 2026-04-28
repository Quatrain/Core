import { BaseObject } from './BaseObject'
import { StringProperty } from '../properties/StringProperty'

class TestModel extends BaseObject {
   static COLLECTION = 'test_collection'
   static PROPS_DEFINITION = [
      {
         name: 'testProp',
         type: StringProperty.TYPE,
      },
   ]
}

describe('BaseObject', () => {
   describe('factory()', () => {
      it('should prefix string source with collection name if no slash is present', async () => {
         const obj = await TestModel.factory('12345')
         expect(obj.uri.path).toBe('test_collection/12345')
      })

      it('should not prefix string source with collection name if a slash is present', async () => {
         const obj = await TestModel.factory('other_collection/12345')
         expect(obj.uri.path).toBe('other_collection/12345')
      })

      it('should handle object creation from data', async () => {
         const obj = await TestModel.factory({ testProp: 'hello' })
         expect(obj.val('testProp')).toBe('hello')
         // The new instance path depends on ObjectUri behavior, usually collection/default
         expect(obj.uri.path.startsWith('test_collection/')).toBeTruthy()
      })
   })
})
