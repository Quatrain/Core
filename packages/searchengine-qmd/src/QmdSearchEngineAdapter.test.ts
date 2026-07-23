import * as fs from 'fs';
import * as path from 'path';
import { QmdSearchEngineAdapter } from './QmdSearchEngineAdapter';

describe('QmdSearchEngineAdapter Package', () => {
   const testDir = path.resolve(__dirname, '../.test-qmd-storage');

   afterAll(() => {
      if (fs.existsSync(testDir)) {
         fs.rmSync(testDir, { recursive: true, force: true });
      }
   });

   it('should initialize storage directory and adapter configuration', async () => {
      const adapter = new QmdSearchEngineAdapter({
         alias: 'qmd-test',
         config: {
            collectionName: 'test-collection',
            storageDir: testDir
         }
      });

      await adapter.initialize();
      expect(adapter.collectionName).toBe('test-collection');
      expect(fs.existsSync(testDir)).toBe(true);
   });

   it('should index and search documents with relevance scoring', async () => {
      const adapter = new QmdSearchEngineAdapter({
         config: { storageDir: testDir }
      });
      await adapter.initialize();

      await adapter.indexDocument({
         id: 'doc-okf-spec',
         title: 'OKF Specification',
         content: 'Open Knowledge Format specifies how Markdown files feed AI agents.',
         category: 'technology/ai',
         tags: ['markdown', 'spec']
      });

      await adapter.indexDocument({
         id: 'doc-agri-guide',
         title: 'AgTech Soil Sensor Guide',
         content: 'IoT sensors measure soil moisture and temperature in smart farming.',
         category: 'agriculture'
      });

      // Query 1: Search for Markdown
      const results1 = await adapter.search('Markdown');
      expect(results1.length).toBe(1);
      expect(results1[0].id).toBe('doc-okf-spec');
      expect(results1[0].score).toBeGreaterThan(0);

      // Query 2: Search with category scope
      const results2 = await adapter.search('sensors', { category: 'agriculture' });
      expect(results2.length).toBe(1);
      expect(results2[0].id).toBe('doc-agri-guide');

      // Query 3: Search outside category
      const results3 = await adapter.search('sensors', { category: 'technology' });
      expect(results3.length).toBe(0);
   });

   it('should remove document and clear index', async () => {
      const adapter = new QmdSearchEngineAdapter({
         config: { storageDir: testDir }
      });
      await adapter.initialize();

      await adapter.indexDocument({
         id: 'temp-doc',
         title: 'Temporary Note',
         content: 'To be deleted'
      });

      let results = await adapter.search('Temporary');
      expect(results.length).toBe(1);

      await adapter.removeDocument('temp-doc');
      results = await adapter.search('Temporary');
      expect(results.length).toBe(0);

      await adapter.clearIndex();
      const allResults = await adapter.search('');
      expect(allResults.length).toBe(0);
   });
});
