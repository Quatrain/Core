import { Schema, Type } from '@google/genai';
import { GenericDomainProfile } from './profiles/generic';
import { buildDocumentPrompt } from './prompts/documentPrompt';
import { resolveStructuredRunner } from './runner';
import {
   AiRunnerResponse,
   DomainTaxonomyProfile,
   ExtractionOptions,
   IngestionExtractionResult,
   OkfDocumentType,
   OkfFrontmatterV2,
   OkfMultilingualContent,
   OkfMultilingualKeywords,
   OkfTokenUsage,
} from './types';

export const OKF_CORE_PROPERTIES: Record<string, Schema> = {
   title: { type: Type.STRING },
   type: { type: Type.STRING },
   description: { type: Type.STRING },
   category: { type: Type.STRING },
   tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
   },
   authors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
   },
   publisher: { type: Type.STRING },
   publicationYear: { type: Type.STRING },
   language: { type: Type.STRING },
   originalLanguage: { type: Type.STRING },
   abstracts: {
      type: Type.OBJECT,
      properties: {
         fr: { type: Type.STRING },
         en: { type: Type.STRING },
         ar: { type: Type.STRING },
      },
      required: ['fr', 'en', 'ar'],
   },
   keywords: {
      type: Type.OBJECT,
      properties: {
         fr: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
         },
         en: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
         },
         ar: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
         },
      },
      required: ['fr', 'en', 'ar'],
   },
   diagrams: {
      type: Type.ARRAY,
      items: {
         type: Type.OBJECT,
         properties: {
            title: { type: Type.STRING },
            type: { type: Type.STRING },
            content: { type: Type.STRING },
            explanation: { type: Type.STRING },
         },
         required: ['title', 'type', 'content', 'explanation'],
      },
   },
};

/**
 * Builds a composite OKF JSON Schema by merging universal core properties
 * with domain-specific taxonomy fields from the provided profile.
 */
export function buildOkfAiSchema(profile?: DomainTaxonomyProfile): Schema {
   const properties: Record<string, Schema> = {
      ...OKF_CORE_PROPERTIES,
      ...((profile?.schemaProperties as Record<string, Schema>) || {}),
   };

   return {
      type: Type.OBJECT,
      properties,
      required: ['title', 'description', 'category', 'tags', 'language', 'abstracts', 'keywords'],
   };
}

export const OKF_INGEST_AI_SCHEMA: Schema = buildOkfAiSchema();

export interface AiSourceInput {
   buffer?: Buffer;
   rawText?: string;
   filename: string;
   isPdf?: boolean;
   isScanned?: boolean;
}

/**
 * Extracts semantic metadata, transcribes diagrams/tables, and tracks token usage.
 * Model-agnostic and composable with domain taxonomy profiles.
 */
export async function extractSemanticContent(
   input: AiSourceInput,
   apiKey?: string,
   options: ExtractionOptions = {}
): Promise<IngestionExtractionResult> {
   const runner = resolveStructuredRunner(apiKey || options.apiKey, options.runner);
   const profile = options.taxonomyProfile || new GenericDomainProfile();
   const schema = buildOkfAiSchema(profile);
   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

   const prompt = buildDocumentPrompt(
      {
         filename: input.filename,
         rawText: input.rawText,
         isScanned: input.isScanned,
         contextNote: options.contextNote,
         maxExcerptChars: options.maxContentChars,
      },
      profile
   );

   const canSendInline =
      Boolean(input.isScanned && input.buffer && input.isPdf && input.buffer.length <= 15 * 1024 * 1024);

   let result: AiRunnerResponse<Record<string, unknown>>;

   if (canSendInline && input.buffer && runner.generateStructuredMultimodal) {
      result = await runner.generateStructuredMultimodal<Record<string, unknown>>(
         prompt,
         [{ mimeType: 'application/pdf', data: input.buffer.toString('base64') }],
         schema,
         { model }
      );
   } else {
      result = await runner.generateStructured<Record<string, unknown>>(prompt, schema, { model });
   }

   const parsed = result.data;
   const usage: OkfTokenUsage = result.usage;

   // Process visual diagrams & Markdown tables
   const diagrams = Array.isArray(parsed.diagrams) ? parsed.diagrams : [];
   let visualMarkdown = '';
   let diagramsCount = 0;
   let tablesCount = 0;

   if (diagrams.length > 0) {
      const parts: string[] = ['\n\n## Visual Synthesis & Technical Schemas\n'];
      for (const diag of diagrams) {
         if (typeof diag === 'object' && diag !== null) {
            const d = diag as Record<string, unknown>;
            const dType = String(d.type || 'table');
            const dTitle = String(d.title || 'Diagram');
            const dContent = String(d.content || '').trim();
            const dExpl = String(d.explanation || '').trim();

            parts.push(`### ${dTitle}\n`);
            if (dType === 'mermaid' && dContent) {
               diagramsCount++;
               parts.push('```mermaid\n' + dContent + '\n```\n');
            } else if (dType === 'table' && dContent) {
               tablesCount++;
               parts.push(dContent + '\n');
            } else if (dContent) {
               parts.push(`> ${dContent}\n`);
            }
            if (dExpl) {
               parts.push(`*${dExpl}*\n`);
            }
         }
      }
      visualMarkdown = parts.join('\n');
   }

   const title = typeof parsed.title === 'string' ? parsed.title : input.filename.replace(/\.[^/.]+$/, '');
   const description = typeof parsed.description === 'string' ? parsed.description : 'Ingested technical document.';
   const domainMeta = profile.extractDomainMetadata ? profile.extractDomainMetadata(parsed) : {};

   const metadata: OkfFrontmatterV2 = {
      type: typeof parsed.type === 'string' ? (parsed.type as OkfDocumentType) : 'guide',
      title,
      description,
      tags:
         Array.isArray(parsed.tags) && parsed.tags.length > 0
            ? (parsed.tags as string[])
            : (profile.defaultTags || ['knowledge']),
      category:
         typeof parsed.category === 'string'
            ? parsed.category
            : (options.defaultCategory || profile.defaultCategory || 'general'),
      authors: Array.isArray(parsed.authors) ? (parsed.authors as string[]) : undefined,
      publisher: typeof parsed.publisher === 'string' ? parsed.publisher : undefined,
      publicationYear: typeof parsed.publicationYear === 'string' ? parsed.publicationYear : undefined,
      language: typeof parsed.language === 'string' ? parsed.language : 'fr',
      originalLanguage:
         typeof parsed.originalLanguage === 'string'
            ? parsed.originalLanguage
            : typeof parsed.language === 'string'
              ? parsed.language
              : 'fr',
      abstracts:
         typeof parsed.abstracts === 'object' && parsed.abstracts !== null
            ? (parsed.abstracts as OkfMultilingualContent)
            : undefined,
      keywords:
         typeof parsed.keywords === 'object' && parsed.keywords !== null
            ? (parsed.keywords as OkfMultilingualKeywords)
            : undefined,
      status: 'draft',
      generated: {
         by: `quatrain/okf-ingest (${model})`,
         at: new Date().toISOString(),
         tokens: usage,
      },
      ...domainMeta,
   };

   const mainText = (input.rawText || '').trim();
   const body = mainText ? `# ${title}\n\n${mainText}${visualMarkdown}` : `# ${title}\n\n${description}${visualMarkdown}`;

   return {
      metadata,
      rawText: mainText,
      body,
      usage,
      isScannedPdf: Boolean(input.isScanned),
      diagramsTranscribed: diagramsCount,
      tablesTranscribed: tablesCount,
   };
}
