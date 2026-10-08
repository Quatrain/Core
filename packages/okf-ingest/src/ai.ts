import { resolveAiAdapter } from './adapter';
import { calculateTokenCost, RawTokenUsageMetadata } from './cost';
import { GenericDomainProfile } from './profiles/generic';
import { buildDocumentPrompt } from './prompts/documentPrompt';
import {
   DomainTaxonomyProfile,
   ExtractionOptions,
   IngestionExtractionResult,
   OkfDocumentType,
   OkfFrontmatterV2,
   OkfJsonSchema,
   OkfJsonSchemaProperty,
   OkfMultilingualContent,
   OkfMultilingualKeywords,
   OkfTokenUsage,
} from './types';

export const OKF_DIAGRAMS_SCHEMA_PROPERTY: OkfJsonSchemaProperty = {
   type: 'ARRAY',
   items: {
      type: 'OBJECT',
      properties: {
         title: { type: 'STRING' },
         type: { type: 'STRING' },
         content: { type: 'STRING' },
         explanation: { type: 'STRING' },
      },
      required: ['title', 'type', 'content', 'explanation'],
   },
};

/**
 * Universal JSON Schema properties for core OKF document metadata.
 */
export const OKF_BASE_PROPERTIES: Record<string, OkfJsonSchemaProperty> = {
   title: { type: 'STRING' },
   type: { type: 'STRING' },
   description: { type: 'STRING' },
   category: { type: 'STRING' },
   tags: {
      type: 'ARRAY',
      items: { type: 'STRING' },
   },
   authors: {
      type: 'ARRAY',
      items: { type: 'STRING' },
   },
   publisher: { type: 'STRING' },
   publicationYear: { type: 'STRING' },
   language: { type: 'STRING' },
   originalLanguage: { type: 'STRING' },
   license: { type: 'STRING' },
   copyright: { type: 'STRING' },
   diagrams: OKF_DIAGRAMS_SCHEMA_PROPERTY,
};

/**
 * Builds schema properties for multilingual abstracts and keywords.
 */
export function buildMultilingualSchemaProperties(languages: string[]): {
   abstractProps: Record<string, OkfJsonSchemaProperty>;
   keywordProps: Record<string, OkfJsonSchemaProperty>;
} {
   const abstractProps: Record<string, OkfJsonSchemaProperty> = Object.fromEntries(
      languages.map((lang) => [lang, { type: 'STRING' }])
   );
   const keywordProps: Record<string, OkfJsonSchemaProperty> = Object.fromEntries(
      languages.map((lang) => [lang, { type: 'ARRAY', items: { type: 'STRING' } }])
   );
   return { abstractProps, keywordProps };
}

/**
 * Builds a composite OKF JSON Schema by merging universal core properties
 * with domain-specific taxonomy fields and dynamically configured target languages.
 */
export function buildOkfAiSchema(
   profile?: DomainTaxonomyProfile,
   languages: string[] = ['en']
): OkfJsonSchema {
   const { abstractProps, keywordProps } = buildMultilingualSchemaProperties(languages);

   const properties: Record<string, OkfJsonSchemaProperty> = {
      ...OKF_BASE_PROPERTIES,
      abstracts: {
         type: 'OBJECT',
         properties: abstractProps,
         required: languages,
      },
      keywords: {
         type: 'OBJECT',
         properties: keywordProps,
         required: languages,
      },
      ...(profile?.schemaProperties as Record<string, OkfJsonSchemaProperty> | undefined),
   };

   return {
      type: 'OBJECT',
      properties,
      required: ['title', 'description', 'category', 'tags', 'language', 'abstracts', 'keywords'],
   };
}

export const OKF_INGEST_AI_SCHEMA: OkfJsonSchema = buildOkfAiSchema();

export interface AiSourceInput {
   buffer?: Buffer;
   rawText?: string;
   filename: string;
   isPdf?: boolean;
   isScanned?: boolean;
}

/**
 * Extracts semantic metadata, transcribes diagrams/tables, and tracks token usage.
 * Model-agnostic and delegates strictly through @quatrain/ai adapters.
 */
export async function extractSemanticContent(
   input: AiSourceInput,
   apiKey?: string,
   options: ExtractionOptions = {}
): Promise<IngestionExtractionResult> {
   const adapter = resolveAiAdapter({ adapter: options.adapter, apiKey: apiKey || options.apiKey });
   const profile = options.taxonomyProfile || new GenericDomainProfile();
   const targetLanguages = options.targetLanguages || options.languages || profile.targetLanguages || ['en'];
   const schema = buildOkfAiSchema(profile, targetLanguages);
   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

   const prompt = buildDocumentPrompt(
      {
         filename: input.filename,
         rawText: input.rawText,
         isScanned: input.isScanned,
         contextNote: options.contextNote,
         maxExcerptChars: options.maxContentChars,
         languages: targetLanguages,
      },
      profile
   );

   const usageHolder: { usage: RawTokenUsageMetadata | null } = { usage: null };
   let parsed: Record<string, unknown>;

   const canSendInline =
      Boolean(input.isScanned && input.buffer && input.isPdf && input.buffer.length <= 15 * 1024 * 1024);

   if (canSendInline && input.buffer) {
      const contents = [
         prompt,
         {
            inlineData: {
               mimeType: 'application/pdf',
               data: input.buffer.toString('base64'),
            },
         },
      ];
      parsed = (await adapter.generateStructured(contents, schema, {
         model,
         onUsage: (u: unknown) => {
            if (typeof u === 'object' && u !== null) {
               usageHolder.usage = u as RawTokenUsageMetadata;
            }
         },
      })) as Record<string, unknown>;
   } else {
      parsed = (await adapter.generateStructured(prompt, schema, {
         model,
         onUsage: (u: unknown) => {
            if (typeof u === 'object' && u !== null) {
               usageHolder.usage = u as RawTokenUsageMetadata;
            }
         },
      })) as Record<string, unknown>;
   }

   // Normalize if model mirrored schema metadata structure { type: 'OBJECT', properties: { ... } }
   if (parsed.properties && typeof parsed.properties === 'object' && !parsed.title) {
      parsed = parsed.properties as Record<string, unknown>;
   }

   let usage: OkfTokenUsage;
   if (usageHolder.usage) {
      usage = calculateTokenCost(usageHolder.usage, model);
   } else {
      const estPrompt = Math.ceil(prompt.length / 4);
      const estOutput = Math.ceil(JSON.stringify(parsed).length / 4);
      usage = calculateTokenCost(
         { promptTokenCount: estPrompt, candidatesTokenCount: estOutput, totalTokenCount: estPrompt + estOutput },
         model
      );
   }

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

   // Construct dynamic multilingual abstracts & keywords
   const abstracts: OkfMultilingualContent = {};
   if (typeof parsed.abstracts === 'object' && parsed.abstracts !== null) {
      const parsedAbs = parsed.abstracts as Record<string, unknown>;
      for (const lang of targetLanguages) {
         const val = Reflect.get(parsedAbs, lang);
         if (typeof val === 'string') {
            Reflect.set(abstracts, lang, val);
         }
      }
   }

   const keywords: OkfMultilingualKeywords = {};
   if (typeof parsed.keywords === 'object' && parsed.keywords !== null) {
      const parsedKw = parsed.keywords as Record<string, unknown>;
      for (const lang of targetLanguages) {
         const val = Reflect.get(parsedKw, lang);
         if (Array.isArray(val)) {
            Reflect.set(keywords, lang, val as string[]);
         }
      }
   }

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
      language: typeof parsed.language === 'string' ? parsed.language : targetLanguages[0] || 'en',
      originalLanguage:
         typeof parsed.originalLanguage === 'string'
            ? parsed.originalLanguage
            : typeof parsed.language === 'string'
              ? parsed.language
              : targetLanguages[0] || 'en',
      abstracts: Object.keys(abstracts).length > 0 ? abstracts : undefined,
      keywords: Object.keys(keywords).length > 0 ? keywords : undefined,
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
