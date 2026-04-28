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

TestModel.factory('12345').then(obj => {
   console.log('--- PATH ---', obj.uri.path)
   console.log('--- URI ---', obj.uri)
}).catch(console.error)
