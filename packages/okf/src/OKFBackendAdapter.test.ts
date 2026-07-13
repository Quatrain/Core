import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { OKFBackendAdapter } from './OKFBackendAdapter';
import { Backend } from '@quatrain/backend';
import { PersistedBaseObject } from '@quatrain/backend';
import { StringProperty, DateTimeProperty } from '@quatrain/core';

class OKFTestObject extends PersistedBaseObject {
   static COLLECTION = 'test_collection';
   static PROPS_DEFINITION = [
      { name: 'name', type: StringProperty.TYPE },
      { name: 'createdBy', type: StringProperty.TYPE }
   ];
}

class OKFTelemetryObject extends PersistedBaseObject {
   static COLLECTION = 'telemetry';
   static PROPS_DEFINITION = [
      { name: 'type', type: StringProperty.TYPE },
      { name: 'bassin', type: StringProperty.TYPE },
      { name: 'createdAt', type: DateTimeProperty.TYPE },
      { name: 'createdBy', type: StringProperty.TYPE }
   ];
}

describe('OKFBackendAdapter', () => {
   const testDir = path.resolve(__dirname, '__test_okf_data__');
   let adapter: OKFBackendAdapter;

   beforeAll(async () => {
      await fs.mkdir(testDir, { recursive: true });
      adapter = new OKFBackendAdapter({
         config: { database: testDir }
      });
      Backend.addBackend(adapter, 'okf_test', true);
   });

   afterAll(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
   });

   test('should format relative OKF filepath correctly for regular objects', async () => {
      const obj = await OKFTestObject.factory();
      const relativePath = adapter.getOKFPath(obj.dataObject, '123-abc');
      expect(relativePath).toBe(path.join('test_collection', '123-abc.json'));
   });

   test('should format relative OKF filepath correctly for telemetry', async () => {
      const dateString = '2026-07-12T14:30:45.120Z';
      const obj = await OKFTelemetryObject.factory();
      obj.set('type', 'ph');
      obj.set('bassin', 'bac-04');
      obj.set('createdAt', dateString);

      const relativePath = adapter.getOKFPath(obj.dataObject, 'some-uid');
      // Should result in telemetry/2026-07-12/ph/143045-120-bac-04.json
      expect(relativePath).toBe(path.join('telemetry', '2026-07-12', 'ph', '143045-120-bac-04.json'));
   });

   test('should perform CRUD operations', async () => {
      // 1. Create
      const obj = await OKFTestObject.factory();
      obj.set('name', 'Poisson Tilapia');
      obj.set('createdBy', 'pascal@sodav.ci');
      await obj.save();
      expect(obj.dataObject.uri.uid).toBeDefined();

      const savedUid = obj.dataObject.uri.uid;
      const expectedPath = path.join(testDir, 'test_collection', `${savedUid}.json`);
      const fileExists = await fs.stat(expectedPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file content structure
      const raw = await fs.readFile(expectedPath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.meta.created_by).toBe('pascal@sodav.ci');
      expect(parsed.data.name).toBe('Poisson Tilapia');

      // 2. Read
      const loaded = await OKFTestObject.fromBackend<OKFTestObject>(savedUid);
      expect(loaded.val('name')).toBe('Poisson Tilapia');

      // 3. Update
      loaded.set('name', 'Tilapia Rouge');
      await loaded.save();

      const loaded2 = await OKFTestObject.fromBackend<OKFTestObject>(savedUid);
      expect(loaded2.val('name')).toBe('Tilapia Rouge');

      // 4. Find
      const results = await OKFTestObject.repository().query(OKFTestObject.query());
      expect(results.items.length).toBe(1);
      expect(results.items[0].val('name')).toBe('Tilapia Rouge');

      // 5. Delete
      await loaded2.delete();
      const fileExistsAfterDelete = await fs.stat(expectedPath).then(() => true).catch(() => false);
      expect(fileExistsAfterDelete).toBe(false);
   });
});
