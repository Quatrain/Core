import { StringProperty } from '@quatrain/core';
import { PersistedBaseObject } from '@quatrain/backend';

const EditorProperties = [
   {
      name: 'city',
      type: StringProperty.TYPE,
      mandatory: false
   }
];

class Editor extends PersistedBaseObject {
   static PROPS_DEFINITION = EditorProperties;
   static COLLECTION = 'editors';

   static async factory(src: any = undefined): Promise<any> {
      return super.factory(src, Editor);
   }
}

async function test() {
   const e = await Editor.factory();
   const props = Object.values(e.dataObject.properties) as any[];
   for (const p of props) {
      console.log(p.name, p.mandatory, p.protected);
   }
}

test().catch(console.error);
