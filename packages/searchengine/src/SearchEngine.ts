import { Core } from '@quatrain/core';
import { AbstractSearchEngineAdapter } from './AbstractSearchEngineAdapter';
import { SearchDocument, SearchQueryOptions, SearchResultItem } from './types/SearchParameters';

export type SearchEngineRegistry<T extends AbstractSearchEngineAdapter> = { [x: string]: T };

/**
 * Singleton Registry dispatching document indexing and search operations across configured search engine providers.
 */
export class SearchEngine extends Core {
   /** Reference identifier for the primary default search engine. */
   static defaultEngine = '@default';
   /** Domain-specific Core Logger instance. */
   static logger = this.addLogger('SearchEngine');

   protected static _engines: SearchEngineRegistry<any> = {};

   /**
    * Registers an instantiated search engine adapter into the registry.
    *
    * @param engine - The instantiated search provider adapter.
    * @param alias - Look-up name alias.
    * @param setDefault - Set as the primary search engine router if true.
    */
   static addEngine(
      engine: AbstractSearchEngineAdapter,
      alias: string = this.defaultEngine,
      setDefault: boolean = false
   ): void {
      this._engines[alias] = engine;
      if (setDefault || alias === this.defaultEngine) {
         this.defaultEngine = alias;
      }
   }

   /**
    * Retrieves an active search engine adapter from the registry by its alias.
    *
    * @param alias - Adapter lookup name.
    * @returns Instantiated search engine provider.
    * @throws Error if alias is not registered.
    */
   static getEngine<T extends AbstractSearchEngineAdapter>(
      alias: string = this.defaultEngine
   ): T {
      if (this._engines[alias]) {
         return this._engines[alias] as T;
      } else {
         throw new Error(`Unknown SearchEngine alias: '${alias}'`);
      }
   }

   /**
    * Indexes a document using the default search engine adapter.
    *
    * @param doc - Document to index.
    * @param alias - Optional engine alias override.
    */
   static async indexDocument(
      doc: SearchDocument,
      alias: string = this.defaultEngine
   ): Promise<void> {
      const engine = this.getEngine(alias);
      await engine.indexDocument(doc);
   }

   /**
    * Executes a query using the default search engine adapter.
    *
    * @param query - Free text search query string.
    * @param options - Search query parameters.
    * @param alias - Optional engine alias override.
    * @returns Matching search result items.
    */
   static async search(
      query: string,
      options?: SearchQueryOptions,
      alias: string = this.defaultEngine
   ): Promise<SearchResultItem[]> {
      const engine = this.getEngine(alias);
      return await engine.search(query, options);
   }
}
