import {
   BookOutlineChapter,
   OkfFrontmatterV2,
   OkfMultilingualContent,
   OkfMultilingualKeywords,
   OkfTokenUsage,
} from '@quatrain/okf-ingest';

/**
 * Direct reference to the parent book or source publication.
 */
export interface CatalogParentBookRef {
   title: string;
   slug: string;
   resource: string;
   fileHash: string;
   authors?: string[];
   publisher?: string;
   publicationYear?: string | number;
   edition?: string;
}

/**
 * Strict OKF v0.2 frontmatter metadata for an encyclopedic/catalog entry.
 */
export interface OkfCatalogEntryMetadata extends OkfFrontmatterV2 {
   /** Absolute sequential position of this entry within the parent catalog (1, 2, ... N) */
   sequence: number;
   /** Page or page range in original publication (e.g. "48-50", "128") */
   pageRange?: string;
   /** Canonical Latin or scientific nomenclature */
   scientificName?: string;
   /** Vernacular, common or alternative trade names */
   vernacularNames?: string[];
   /** Botanical, zoological or chemical family */
   family?: string;
   /** Botanical or chemical synonyms */
   synonyms?: string[];
   /** Detailed bio-indication, soil diagnostic keys or active mechanisms */
   diagnosticKeys?: string[];
   /** Categorized pharmacological, agronomic or functional properties */
   properties?: string[];
   /** Traceable parent book metadata */
   parentBook: CatalogParentBookRef;
}

/**
 * Textual slice corresponding to a single catalog entry prior to AI enrichment.
 */
export interface CatalogEntryChunk {
   sequence: number;
   rawTitle: string;
   slug: string;
   pageRange?: string;
   scientificName?: string;
   family?: string;
   text: string;
}

/**
 * Result of enriching a single catalog entry with AI.
 */
export interface CatalogEntryResult {
   sequence: number;
   slug: string;
   metadata: OkfCatalogEntryMetadata;
   body: string;
   relativePath: string;
   usage: OkfTokenUsage;
   diagramsTranscribed: number;
   tablesTranscribed: number;
}

/**
 * Configuration options for catalog monograph ingestion.
 */
export interface CatalogIngestionOptions {
   apiKey: string;
   gitLocalPath: string;
   originalFileUri: string;
   fileHash: string;
   filename: string;
   defaultCategory?: string;
   model?: string;
   soa?: string;
   revision?: string;
   entryType?: string;
   onProgress?: (current: number, total: number, entryTitle: string) => void;
}

/**
 * Aggregated execution report for an ingested catalog.
 */
export interface CatalogIngestionSummary {
   bookSlug: string;
   bookTitle: string;
   masterIndexPath: string;
   totalEntries: number;
   totalChapters: number;
   createdFiles: string[];
   usage: OkfTokenUsage;
   totalDiagrams: number;
   totalTables: number;
}
