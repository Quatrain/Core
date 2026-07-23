/**
 * Document structure to be indexed by search engine adapters.
 */
export interface SearchDocument {
   /** Unique identifier of the document. */
   id: string;
   /** Primary title or heading of the document. */
   title: string;
   /** Full text content or body of the document. */
   content: string;
   /** Optional relative or absolute file path. */
   path?: string;
   /** Optional summary or excerpt. */
   summary?: string;
   /** Category identifier or folder path. */
   category?: string;
   /** Tag list attached to the document. */
   tags?: string[];
   /** Additional unstructured metadata key-value pairs. */
   metadata?: Record<string, any>;
}

/**
 * Options controlling search behavior and execution mode.
 */
export interface SearchQueryOptions {
   /** Maximum number of search results to return (default: 20). */
   limit?: number;
   /** Category filter to scope the search query. */
   category?: string;
   /** Search methodology: hybrid (BM25 + Vector), vector, or bm25. */
   mode?: 'hybrid' | 'vector' | 'bm25';
   /** Enables intelligent LLM re-ranking on search results. */
   rerank?: boolean;
}

/**
 * Standardized search result entry returned by search engines.
 */
export interface SearchResultItem {
   /** Unique identifier of the matched document. */
   id: string;
   /** Title of the matched document. */
   title: string;
   /** File path or URI if applicable. */
   path?: string;
   /** Relevance score (higher score indicates higher relevance). */
   score: number;
   /** Excerpt or matching text snippet. */
   snippet: string;
   /** Optional document metadata. */
   metadata?: Record<string, any>;
}

/**
 * Generic configuration parameters for search engine adapters.
 */
export interface SearchEngineParameters {
   /** Optional alias name for the adapter registry. */
   alias?: string;
   /** Configuration key-value settings specific to the provider. */
   config?: Record<string, any>;
   /** Optional debug flag for verbose logging. */
   debug?: boolean;
}
