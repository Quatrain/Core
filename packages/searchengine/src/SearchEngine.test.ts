import { SearchEngine } from './SearchEngine';
import { AbstractSearchEngineAdapter } from './AbstractSearchEngineAdapter';
import { SearchDocument, SearchQueryOptions, SearchResultItem } from './types/SearchParameters';

class DummySearchEngineAdapter extends AbstractSearchEngineAdapter {
   public initialized = false;
   public docs: Map<string, SearchDocument> = new Map();

   async initialize(): Promise<void> {
      this.initialized = true;
   }

   async indexDocument(doc: SearchDocument): Promise<void> {
      this.docs.set(doc.id, doc);
   }

   async removeDocument(id: string): Promise<void> {
      this.docs.delete(id);
   }

   async search(query: string, options?: SearchQueryOptions): Promise<SearchResultItem[]> {
      const results: SearchResultItem[] = [];
      for (const doc of this.docs.values()) {
         if (doc.title.includes(query) || doc.content.includes(query)) {
            results.push({
               id: doc.id,
               title: doc.title,
               path: doc.path,
               score: 1.0,
               snippet: doc.content.substring(0, 50)
            });
         }
      }
      return results;
   }
}

describe('SearchEngine Package', () => {
   it('should throw an error when instantiating adapter without params (fail-fast)', () => {
      expect(() => new (DummySearchEngineAdapter as any)(null)).toThrow(
         'SearchEngineAdapter initialization failed: params object is required'
      );
   });

   it('should register and retrieve search engine adapter', async () => {
      const adapter = new DummySearchEngineAdapter({ alias: 'test-engine' });
      await adapter.initialize();
      expect(adapter.initialized).toBe(true);

      SearchEngine.addEngine(adapter, 'test-engine', true);
      const retrieved = SearchEngine.getEngine('test-engine');
      expect(retrieved).toBe(adapter);
   });

   it('should index document and perform search via registry', async () => {
      const adapter = new DummySearchEngineAdapter({ alias: 'primary' });
      SearchEngine.addEngine(adapter, 'primary', true);

      await SearchEngine.indexDocument({
         id: 'doc-1',
         title: 'OKF Specification',
         content: 'Open Knowledge Format for Markdown documents'
      });

      const results = await SearchEngine.search('Knowledge');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('OKF Specification');
   });

   it('should throw an error when retrieving unknown search engine alias', () => {
      expect(() => SearchEngine.getEngine('non-existent')).toThrow("Unknown SearchEngine alias: 'non-existent'");
   });
});
