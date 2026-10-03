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
   isbn?: string;
   doi?: string;
   copyright?: string;
   originalTitle?: string;
   originalLanguage?: string;
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
