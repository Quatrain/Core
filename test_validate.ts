import { BaseObject } from './packages/core/src/components/BaseObject';

async function test() {
   class TestObject extends BaseObject {
       static COLLECTION = 'tests';
       static PROPS_DEFINITION = [];
   }
   
   const obj = await TestObject.factory();
   console.log(typeof obj.validate);
}

test().catch(console.error);
