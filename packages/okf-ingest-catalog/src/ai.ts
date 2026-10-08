import { AbstractAiAdapter } from '@quatrain/ai';
import {
   AiStructuredRunner,
   buildMultilingualSchemaProperties,
   calculateTokenCost,
   DomainTaxonomyProfile,
   GenericDomainProfile,
   OkfDocumentType,
   OkfJsonSchema,
   OkfJsonSchemaProperty,
   OkfTokenUsage,
   OKF_DIAGRAMS_SCHEMA_PROPERTY,
   RawTokenUsageMetadata,
   resolveAiAdapter,
} from '@quatrain/okf-ingest';
import { buildCatalogEntryPrompt } from './prompts/catalogEntryPrompt';
import {
   CatalogEntryChunk,
   CatalogParentBookRef,
   OkfCatalogEntryMetadata,
} from './types';

/**
 * Universal JSON Schema properties for catalog and encyclopedic entries.
 */
export const CATALOG_BASE_PROPERTIES: Record<string, OkfJsonSchemaProperty> = {
   title: { type: 'STRING' },
   scientificName: { type: 'STRING' },
   family: { type: 'STRING' },
   description: { type: 'STRING' },
   category: { type: 'STRING' },
   language: { type: 'STRING' },
   originalLanguage: { type: 'STRING' },
   tags: {
      type: 'ARRAY',
      items: { type: 'STRING' },
   },
   properties: {
      type: 'ARRAY',
      items: { type: 'STRING' },
   },
   diagnosticKeys: {
      type: 'ARRAY',
      items: { type: 'STRING' },
   },
   diagrams: OKF_DIAGRAMS_SCHEMA_PROPERTY,
};

/**
 * Builds a JSON Schema for structured catalog entry extraction,
 * merging universal catalog properties with profile domain extensions and configured target languages.
 */
export function buildCatalogAiSchema(
   profile?: DomainTaxonomyProfile,
   languages: string[] = ['en']
): OkfJsonSchema {
   const { abstractProps, keywordProps } = buildMultilingualSchemaProperties(languages);

   const properties: Record<string, OkfJsonSchemaProperty> = {
      ...CATALOG_BASE_PROPERTIES,
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
      required: [
         'title',
         'scientificName',
         'family',
         'description',
         'language',
         'abstracts',
         'keywords',
         'tags',
      ],
   };
}

export const CATALOG_ENTRY_AI_SCHEMA: OkfJsonSchema = buildCatalogAiSchema();

export interface EntryExtractionOptions {
   apiKey?: string;
   adapter?: AbstractAiAdapter;
   runner?: AiStructuredRunner;
   targetLanguages?: string[];
   languages?: string[];
   parentBook: CatalogParentBookRef;
   entryType?: OkfDocumentType;
   model?: string;
   defaultCategory?: string;
   soa?: string;
   revision?: string;
   taxonomyProfile?: DomainTaxonomyProfile;
}

/**
 * Extracts and enriches a single encyclopedic/catalog entry.
 * Model-agnostic and delegates strictly through @quatrain/ai adapters.
 */
export async function extractCatalogEntryContent(
   chunk: CatalogEntryChunk,
   options: EntryExtractionOptions
): Promise<{
   metadata: OkfCatalogEntryMetadata;
   body: string;
   usage: OkfTokenUsage;
   diagramsTranscribed: number;
   tablesTranscribed: number;
}> {
   const adapter = resolveAiAdapter({ adapter: options.adapter, apiKey: options.apiKey });
   const profile = options.taxonomyProfile || new GenericDomainProfile();
   const targetLanguages = options.targetLanguages || options.languages || profile.targetLanguages || ['en'];
   const schema = buildCatalogAiSchema(profile, targetLanguages);
   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

   const prompt = buildCatalogEntryPrompt(
      {
         chunk,
         parentBook: options.parentBook,
         languages: targetLanguages,
      },
      profile
   );

   let rawUsage: RawTokenUsageMetadata | null = null;
   const rawRecord = (await adapter.generateStructured(prompt, schema, {
      model,
      onUsage: (u: unknown) => {
         if (typeof u === 'object' && u !== null) {
            rawUsage = u as RawTokenUsageMetadata;
         }
      },
   })) as Record<string, unknown>;

   // Normalize if model mirrored schema metadata structure { type: 'OBJECT', properties: { ... } }
   const parsed =
      rawRecord.properties && typeof rawRecord.properties === 'object' && !rawRecord.title
         ? (rawRecord.properties as Record<string, unknown>)
         : rawRecord;

   let usage: OkfTokenUsage;
   if (rawUsage !== null) {
      usage = calculateTokenCost(rawUsage, model);
   } else {
      const estPrompt = Math.ceil(prompt.length / 4);
      const estOutput = Math.ceil(JSON.stringify(parsed).length / 4);
      usage = calculateTokenCost(
         { promptTokenCount: estPrompt, candidatesTokenCount: estOutput, totalTokenCount: estPrompt + estOutput },
         model
      );
   }

   const title = typeof parsed.title === 'string' ? parsed.title : chunk.rawTitle;
   const scientificName = typeof parsed.scientificName === 'string' ? parsed.scientificName : chunk.scientificName;
   const family = typeof parsed.family === 'string' ? parsed.family : chunk.family;
   const description = typeof parsed.description === 'string' ? parsed.description : `Catalog entry for ${title}.`;
   const category =
      typeof parsed.category === 'string'
         ? parsed.category
         : (options.defaultCategory || profile.defaultCategory || 'catalog');
   const language = typeof parsed.language === 'string' ? parsed.language : (targetLanguages[0] || 'en');
   const originalLanguage =
      typeof parsed.originalLanguage === 'string'
         ? parsed.originalLanguage
         : language;

   const abstracts: OkfCatalogEntryMetadata['abstracts'] = {};
   if (typeof parsed.abstracts === 'object' && parsed.abstracts !== null) {
      const parsedAbs = parsed.abstracts as Record<string, unknown>;
      for (const lang of targetLanguages) {
         const val = Reflect.get(parsedAbs, lang);
         if (typeof val === 'string') {
            Reflect.set(abstracts, lang, val);
         }
      }
   }
   if (Object.keys(abstracts).length === 0) {
      for (const lang of targetLanguages) {
         Reflect.set(abstracts, lang, description);
      }
   }

   const keywords: OkfCatalogEntryMetadata['keywords'] = {};
   if (typeof parsed.keywords === 'object' && parsed.keywords !== null) {
      const parsedKw = parsed.keywords as Record<string, unknown>;
      for (const lang of targetLanguages) {
         const val = Reflect.get(parsedKw, lang);
         if (Array.isArray(val)) {
            Reflect.set(keywords, lang, val as string[]);
         }
      }
   }
   if (Object.keys(keywords).length === 0) {
      for (const lang of targetLanguages) {
         Reflect.set(keywords, lang, [title]);
      }
   }

   const tags = Array.isArray(parsed.tags) ? (parsed.tags as string[]) : [];
   const properties = Array.isArray(parsed.properties) ? (parsed.properties as string[]) : undefined;
   const diagnosticKeys = Array.isArray(parsed.diagnosticKeys) ? (parsed.diagnosticKeys as string[]) : undefined;

   // Process diagrams and Markdown tables
   let diagramsCount = 0;
   let tablesCount = 0;
   const diagramsList: string[] = [];

   if (Array.isArray(parsed.diagrams)) {
      for (const item of parsed.diagrams) {
         if (typeof item === 'object' && item !== null) {
            const diag = item as Record<string, unknown>;
            const diagType = String(diag.type || 'table');
            const diagTitle = String(diag.title || 'Illustration');
            const diagContent = String(diag.content || '').trim();
            const diagExplanation = String(diag.explanation || '').trim();

            if (diagType === 'mermaid' && diagContent) {
               diagramsCount++;
               diagramsList.push(`### ${diagTitle}\n\n\`\`\`mermaid\n${diagContent}\n\`\`\`\n\n*${diagExplanation}*\n`);
            } else if (diagType === 'table' && diagContent) {
               tablesCount++;
               diagramsList.push(`### ${diagTitle}\n\n${diagContent}\n\n*${diagExplanation}*\n`);
            }
         }
      }
   }

   const domainMeta = profile.extractDomainMetadata ? profile.extractDomainMetadata(parsed) : {};

   const metadata: OkfCatalogEntryMetadata = {
      type: options.entryType || 'catalog-entry',
      title,
      description,
      tags: Array.from(new Set([...tags, options.parentBook.slug])),
      status: 'draft',
      generated: {
         by: `quatrain/okf-ingest-catalog (${model})`,
         at: new Date().toISOString(),
         tokens: usage,
      },
      sources: [
         {
            id: 'parent-book',
            resource: options.parentBook.resource,
            title: options.parentBook.title,
            fileHash: options.parentBook.fileHash,
         },
      ],
      soa: options.soa || 'quatrain/knowledge',
      revision: options.revision,
      category,
      language,
      originalLanguage,
      abstracts,
      keywords,
      sequence: chunk.sequence,
      pageRange: chunk.pageRange,
      scientificName,
      family,
      diagnosticKeys,
      properties,
      parentBook: options.parentBook,
      ...domainMeta,
   };

   // Format rich, structured Markdown body
   let body = `# ${title}\n\n`;
   if (scientificName && family) {
      body += `**Taxonomy / Classification:** *${scientificName}* | **Family / Group:** ${family}\n\n`;
   }
   if (chunk.pageRange) {
      body += `> Extracted from: [${options.parentBook.title}](../index.md) (pages ${chunk.pageRange})\n\n`;
   }

   if (diagnosticKeys && diagnosticKeys.length > 0) {
      body += `## 🔬 Key Diagnostic Criteria & Indicators\n\n`;
      for (const key of diagnosticKeys) {
         body += `- **${key}**\n`;
      }
      body += `\n`;
   }

   if (domainMeta.soils && Array.isArray(domainMeta.soils) && domainMeta.soils.length > 0) {
      body += `## 🌱 Soil & Habitat Characteristics\n\n`;
      for (const s of domainMeta.soils) {
         body += `- ${s}\n`;
      }
      body += `\n`;
   }

   if (properties && properties.length > 0) {
      body += `## 🌿 Properties & Applications\n\n`;
      for (const p of properties) {
         body += `- ${p}\n`;
      }
      body += `\n`;
   }

   if (typeof profile.renderMarkdownSections === 'function') {
      const customSections = profile.renderMarkdownSections(domainMeta);
      if (customSections) {
         body += `${customSections}\n\n`;
      }
   }

   if (diagramsList.length > 0) {
      body += `## 📊 Analytical Data & Diagrams\n\n${diagramsList.join('\n')}\n`;
   }

   body += `## 📖 Detailed Entry Description & Source Text\n\n${chunk.text.trim()}\n`;

   return {
      metadata,
      body,
      usage,
      diagramsTranscribed: diagramsCount,
      tablesTranscribed: tablesCount,
   };
}
