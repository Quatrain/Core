/**
 * Core type contracts for the @quatrain/okf-ingest package.
 * Conforms strictly to the Open Knowledge Format (OKF v0.2) specification.
 */

export interface OkfTokenUsage {
   prompt: number;
   candidates: number;
   thinking: number;
   total: number;
   costUsd: number;
}

export interface OkfSourceEntry {
   id: string;
   resource: string;
   title?: string;
   fileHash?: string;
   author?: string;
   [key: string]: unknown;
}

export interface OkfGenerationMetadata {
   by: string;
   at: string;
   tokens?: OkfTokenUsage;
}

export type OkfDocumentStatus = 'draft' | 'curated' | 'active' | 'archived';

export interface OkfMultilingualContent {
   fr?: string;
   en?: string;
   ar?: string;
   [lang: string]: string | undefined;
}

export interface OkfMultilingualKeywords {
   fr?: string[];
   en?: string[];
   ar?: string[];
   [lang: string]: string[] | undefined;
}

export interface OkfFrontmatterV2 {
   type: string;
   title: string;
   description: string;
   tags: string[];
   status?: OkfDocumentStatus;
   generated?: OkfGenerationMetadata;
   sources?: OkfSourceEntry[];
   // Domain & Repository specific metadata
   soa?: string;
   revision?: string;
   category?: string;
   thematics?: string[];
   soils?: string[];
   climates?: string[];
   itineraries?: string[];
   crops?: string[];
   authors?: string[];
   translators?: string[];
   publisher?: string;
   edition?: string;
   publicationYear?: string | number;
   language?: string;
   originalLanguage?: string;
   abstracts?: OkfMultilingualContent;
   keywords?: OkfMultilingualKeywords;
   isbn?: string;
   doi?: string;
   copyright?: string;
   originalTitle?: string;
   originalPublisher?: string;
   originalYear?: string | number;
   originalCopyright?: string;
   citation?: string;
   documentDate?: string;
   originalFileUri?: string;
   fileHash?: string;
   source?: string;
   links?: string[];
   [key: string]: unknown;
}

export interface OkfDocument {
   metadata: OkfFrontmatterV2;
   body: string;
   relativePath?: string;
}

export interface ExtractionOptions {
   model?: string;
   soa?: string;
   revision?: string;
   defaultCategory?: string;
   enableVisionMermaid?: boolean;
   contextNote?: string;
   maxContentChars?: number;
}

export interface IngestionExtractionResult {
   metadata: OkfFrontmatterV2;
   rawText: string;
   body: string;
   usage: OkfTokenUsage;
   isScannedPdf: boolean;
   diagramsTranscribed: number;
   tablesTranscribed: number;
}

export interface DedupEntry {
   filename: string;
   ingestedAt: string;
   category: string;
   s3Key?: string;
   tokens?: OkfTokenUsage;
}

export interface DedupStats {
   totalFiles: number;
   totalTokens: number;
   totalCostUsd: number;
}

export interface BookOutlineChapter {
   index: number;
   title: string;
   slug: string;
   summary?: string;
   startMarker?: string;
   endMarker?: string;
}

export interface BookOutline {
   title: string;
   slug: string;
   description: string;
   category: string;
   language?: string;
   originalLanguage?: string;
   abstracts?: OkfMultilingualContent;
   keywords?: OkfMultilingualKeywords;
   authors?: string[];
   publisher?: string;
   publicationYear?: string | number;
   thematics?: string[];
   soils?: string[];
   climates?: string[];
   itineraries?: string[];
   crops?: string[];
   tags: string[];
   chapters: BookOutlineChapter[];
}

export interface ChapterExtractionResult {
   index: number;
   title: string;
   slug: string;
   relativePath: string;
   doc: OkfDocument;
   usage: OkfTokenUsage;
   diagramsTranscribed: number;
   tablesTranscribed: number;
}

export interface MonographInput {
   rawText: string;
   filename: string;
   fileHash: string;
   originalFileUri: string;
   gitLocalPath: string;
}

export interface MonographOptions extends ExtractionOptions {
   splitThresholdChars?: number;
   maxChapters?: number;
}

export interface MonographIngestionResult {
   masterDoc: OkfDocument;
   masterRelativePath: string;
   chapterDocs: ChapterExtractionResult[];
   allCreatedFiles: string[];
   folderPath: string;
   totalTokens: OkfTokenUsage;
   totalCostUsd: number;
   totalDiagrams: number;
   totalTables: number;
}
