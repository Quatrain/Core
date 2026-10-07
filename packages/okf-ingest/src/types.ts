import { AbstractAiAdapter } from '@quatrain/ai';

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

export type OkfDocumentType =
   | 'monograph'
   | 'chapter'
   | 'catalog-entry'
   | 'guide'
   | 'technical-report'
   | 'specification'
   | 'reference'
   | 'recipe'
   | 'concept'
   | 'standard'
   | 'note'
   | (string & {});

export interface OkfFrontmatterV2 {
   type: OkfDocumentType;
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
   license?: string;
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

/**
 * Runner options passed to an AiStructuredRunner instance.
 */
export interface AiRunnerOptions {
   model?: string;
   temperature?: number;
   maxOutputTokens?: number;
   systemInstruction?: string;
}

/**
 * Result returned by an AiStructuredRunner execution.
 */
export interface AiRunnerResponse<T = Record<string, unknown>> {
   data: T;
   usage: OkfTokenUsage;
   rawText?: string;
}

/**
 * Multimodal input part for image/PDF payloads.
 */
export interface MultimodalPart {
   mimeType: string;
   data: string; // base64 encoded
}

/**
 * Pluggable AI model runner contract for structured JSON and multimodal generation.
 * Enables zero-coupling with specific model providers (Gemini, OpenAI, Claude, Ollama, etc.).
 */
export interface AiStructuredRunner {
   generateStructured<T = Record<string, unknown>>(
      prompt: string,
      schema: unknown,
      options?: AiRunnerOptions
   ): Promise<AiRunnerResponse<T>>;

   generateStructuredMultimodal?<T = Record<string, unknown>>(
      prompt: string,
      parts: MultimodalPart[],
      schema: unknown,
      options?: AiRunnerOptions
   ): Promise<AiRunnerResponse<T>>;
}

/**
 * Universal JSON Schema definition for AI structured outputs,
 * completely independent of any single model provider.
 */
export interface OkfJsonSchemaProperty {
   type: string;
   description?: string;
   items?: OkfJsonSchemaProperty;
   properties?: Record<string, OkfJsonSchemaProperty>;
   required?: string[];
   enum?: string[];
   [key: string]: unknown;
}

export interface OkfJsonSchema {
   type: string;
   properties: Record<string, OkfJsonSchemaProperty>;
   required?: string[];
   [key: string]: unknown;
}

/**
 * Specification of an individual domain-specific taxonomy field.
 */
export interface DomainTaxonomyField {
   name: string;
   type: 'string' | 'string[]' | 'number' | 'boolean';
   description: string;
   examples?: string[];
   required?: boolean;
}

/**
 * Composable domain profile defining system personas, domain guidelines,
 * schema properties, and metadata extraction rules.
 */
export interface DomainTaxonomyProfile {
   id: string;
   name: string;
   systemRole?: string;
   promptGuidelines?: string[];
   fields?: DomainTaxonomyField[];
   schemaProperties?: Record<string, unknown>;
   extractDomainMetadata?: (rawResult: Record<string, unknown>) => Record<string, unknown>;
   renderMarkdownSections?: (metadata: Record<string, unknown>) => string;
   defaultCategory?: string;
   defaultTags?: string[];
   targetLanguages?: string[];
}

export interface ExtractionOptions {
   model?: string;
   soa?: string;
   revision?: string;
   defaultCategory?: string;
   enableVisionMermaid?: boolean;
   contextNote?: string;
   maxContentChars?: number;
   adapter?: AbstractAiAdapter;
   runner?: AiStructuredRunner;
   apiKey?: string;
   targetLanguages?: string[];
   languages?: string[];
   taxonomyProfile?: DomainTaxonomyProfile;
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
   license?: string;
   copyright?: string;
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
