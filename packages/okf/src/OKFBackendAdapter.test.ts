import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { OKFBackendAdapter } from './OKFBackendAdapter';
import { Backend, PersistedBaseObject, OperatorKeys } from '@quatrain/backend';
import { StringProperty, DateTimeProperty, ArrayProperty } from '@quatrain/core';

class OKFTestObject extends PersistedBaseObject {
   static COLLECTION = 'test_collection';
   static PROPS_DEFINITION = [
      { name: 'name', type: StringProperty.TYPE },
      { name: 'createdBy', type: StringProperty.TYPE },
      { name: 'body', type: StringProperty.TYPE },
      { name: 'links', type: ArrayProperty.TYPE, itemType: StringProperty.TYPE },
      { name: 'backlinks', type: ArrayProperty.TYPE }
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
      expect(relativePath).toBe(path.join('test_collection', '123-abc.md'));
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
      const expectedPath = path.join(testDir, 'test_collection', `${savedUid}.md`);
      const fileExists = await fs.stat(expectedPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file content structure
      const raw = await fs.readFile(expectedPath, 'utf-8');
      expect(raw.startsWith('---')).toBe(true);
      const parts = raw.split('---');
      const parsed = parseYaml(parts[1].trim()) as any;
      expect(parsed.createdBy).toBe('pascal@sodav.ci');
      expect(parsed.name).toBe('Poisson Tilapia');

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

   test('should extract internal links and resolve backlinks', async () => {
      // Create Note B first
      const noteB = await OKFTestObject.factory();
      noteB.set('name', 'Note B');
      noteB.set('createdBy', 'pascal@sodav.ci');
      await noteB.save();
      const uidB = noteB.dataObject.uri.uid;

      // Create Note A pointing to Note B using WikiLink and Markdown link
      const noteA = await OKFTestObject.factory();
      noteA.set('name', 'Note A');
      noteA.set('createdBy', 'pascal@sodav.ci');
      // Set the body/markdown field
      noteA.dataObject.set('body', `Ceci est un lien vers [[${uidB}]] et un autre [Lien](note-c.md)`);
      await noteA.save();
      const uidA = noteA.dataObject.uri.uid;

      // 1. Verify links are stored in frontmatter of Note A
      const pathA = path.join(testDir, 'test_collection', `${uidA}.md`);
      const rawA = await fs.readFile(pathA, 'utf-8');
      const parts = rawA.split('---');
      const parsedA = parseYaml(parts[1].trim()) as any;
      expect(parsedA.links).toBeDefined();
      expect(parsedA.links).toContain(uidB);
      expect(parsedA.links).toContain('note-c.md');

      // 2. Verify links are returned when reading Note A
      const loadedA = await OKFTestObject.fromBackend<OKFTestObject>(uidA);
      expect(loadedA.val('links')).toContain(uidB);
      expect(loadedA.val('links')).toContain('note-c.md');

      // 3. Verify backlinks are resolved when reading Note B
      const loadedB = await OKFTestObject.fromBackend<OKFTestObject>(uidB);
      const backlinksB = loadedB.val('backlinks');
      expect(backlinksB).toBeDefined();
      expect(backlinksB.length).toBe(1);
      expect(backlinksB[0].id).toBe(uidA);
      expect(backlinksB[0].title).toBe('Note A');

      // 4. Verify advanced filter operator "contains" works in query
      const query = OKFTestObject.query().where('links', uidB, OperatorKeys.contains);
      const results = await OKFTestObject.repository().query(query);
      expect(results.items.length).toBe(1);
      expect(results.items[0].uri.uid).toBe(uidA);

      // Clean up
      await noteA.delete();
      await noteB.delete();
   });
});
