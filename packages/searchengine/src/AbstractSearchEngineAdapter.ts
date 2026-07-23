import { SearchDocument, SearchQueryOptions, SearchResultItem, SearchEngineParameters } from './types/SearchParameters';

/**
 * Blueprint for Search Engine adapters (QMD, Meilisearch, SQLite FTS, etc.).
 * Guarantees a unified contract for indexing and hybrid document retrieval.
 */
export abstract class AbstractSearchEngineAdapter {
   protected _params: SearchEngineParameters;

   /**
    * Constructs the search engine adapter with fail-fast validation.
    *
    * @param params - Search engine initialization parameters.
    * @throws Error if parameters are missing.
    */
   constructor(params: SearchEngineParameters) {
      if (!params) {
         throw new Error('SearchEngineAdapter initialization failed: params object is required');
      }
      this._params = params;
   }

   /**
    * Initializes underlying storage, index connections, or binary executables.
    */
   abstract initialize(): Promise<void>;

   /**
    * Indexes or updates a document entry in the search engine repository.
    *
    * @param doc - Document to be indexed.
    */
   abstract indexDocument(doc: SearchDocument): Promise<void>;

   /**
    * Removes a document from the search index by its identifier.
    *
    * @param id - Document identifier.
    */
   abstract removeDocument(id: string): Promise<void>;

   /**
    * Executes a query across the search index.
    *
    * @param query - Free text search query string.
    * @param options - Filtering and execution options.
    * @returns List of matching document entries sorted by relevance score.
    */
   abstract search(query: string, options?: SearchQueryOptions): Promise<SearchResultItem[]>;

   /**
    * Clears all indexed entries from the repository.
    */
   abstract clearIndex?(): Promise<void>;
}
