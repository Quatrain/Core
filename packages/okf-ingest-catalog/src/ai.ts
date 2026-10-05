import { Schema, Type } from '@google/genai';
import {
   AiStructuredRunner,
   DomainTaxonomyProfile,
   GenericDomainProfile,
   OkfDocumentType,
   OkfTokenUsage,
   resolveStructuredRunner,
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
export const CATALOG_CORE_PROPERTIES: Record<string, Schema> = {
   title: { type: Type.STRING },
   scientificName: { type: Type.STRING },
   family: { type: Type.STRING },
   description: { type: Type.STRING },
   category: { type: Type.STRING },
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
   tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
   },
   properties: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
   },
   diagnosticKeys: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
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
 * Builds a JSON Schema for structured catalog entry extraction,
 * merging universal catalog properties with profile domain extensions.
 */
export function buildCatalogAiSchema(profile?: DomainTaxonomyProfile): Schema {
   const properties: Record<string, Schema> = {
      ...CATALOG_CORE_PROPERTIES,
      ...((profile?.schemaProperties as Record<string, Schema>) || {}),
   };

   return {
      type: Type.OBJECT,
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

export const CATALOG_ENTRY_AI_SCHEMA: Schema = buildCatalogAiSchema();

export interface EntryExtractionOptions {
   apiKey?: string;
   runner?: AiStructuredRunner;
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
 * Model-agnostic and composable with domain taxonomy profiles.
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
   const runner = resolveStructuredRunner(options.apiKey, options.runner);
   const profile = options.taxonomyProfile || new GenericDomainProfile();
   const schema = buildCatalogAiSchema(profile);
   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

   const prompt = buildCatalogEntryPrompt(
      {
         chunk,
         parentBook: options.parentBook,
      },
      profile
   );

   const result = await runner.generateStructured<Record<string, unknown>>(prompt, schema, { model });
   const parsed = result.data;
   const usage: OkfTokenUsage = result.usage;

   const title = typeof parsed.title === 'string' ? parsed.title : chunk.rawTitle;
   const scientificName = typeof parsed.scientificName === 'string' ? parsed.scientificName : chunk.scientificName;
   const family = typeof parsed.family === 'string' ? parsed.family : chunk.family;
   const description = typeof parsed.description === 'string' ? parsed.description : `Catalog entry for ${title}.`;
   const category =
      typeof parsed.category === 'string'
         ? parsed.category
         : (options.defaultCategory || profile.defaultCategory || 'catalog');
   const language = typeof parsed.language === 'string' ? parsed.language : 'fr';
   const originalLanguage = typeof parsed.originalLanguage === 'string' ? parsed.originalLanguage : 'fr';

   const abstracts = (typeof parsed.abstracts === 'object' && parsed.abstracts !== null
      ? parsed.abstracts
      : { fr: description, en: description, ar: description }) as OkfCatalogEntryMetadata['abstracts'];

   const keywords = (typeof parsed.keywords === 'object' && parsed.keywords !== null
      ? parsed.keywords
      : { fr: [title], en: [title], ar: [title] }) as OkfCatalogEntryMetadata['keywords'];

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
