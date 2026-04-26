import { SQLiteAdapter } from '@quatrain/backend-sqlite';
import { StudioModel } from '@quatrain/studio';
import { Backend } from '@quatrain/backend';
import path from 'path';

async function test() {
  const sqlitePath = path.resolve(process.cwd(), '../../.quatrain-studio.sqlite');
  Backend.addBackend(new SQLiteAdapter({ 
      config: sqlitePath
  }), 'default', true);

  try {
     const newModel = await StudioModel.factory();
     newModel.set('name', 'TestModel');
     await newModel.save();

     const results = await StudioModel.query().execute('dataObjects' as any);
     console.log('--- ITEMS COUNT ---', results.items.length);
     if (results.items.length > 0) {
        console.log('--- FIRST ITEM ---');
        console.log(JSON.stringify(results.items[0].toJSON(), null, 2));
     }
  } catch (err) {
     console.error('ERROR:', err);
  }
}
test();
