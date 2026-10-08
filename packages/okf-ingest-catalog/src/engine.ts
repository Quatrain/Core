import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
   BookOutlineChapter,
   extractSemanticContent,
   GenericDomainProfile,
   OkfDocumentType,
   OkfFrontmatterV2,
   OkfTokenUsage,
   serializeOkfDocument,
} from '@quatrain/okf-ingest';
import { extractCatalogEntryContent } from './ai';
import { slugify } from './detector';
import {
   CatalogEntryChunk,
   CatalogEntryResult,
   CatalogIngestionOptions,
   CatalogIngestionSummary,
   CatalogParentBookRef,
} from './types';

export interface CatalogMonographInput {
   bookTitle: string;
   description: string;
   category: string;
   authors?: string[];
   publisher?: string;
   publicationYear?: string | number;
   edition?: string;
   language?: string;
   originalLanguage?: string;
   tags?: string[];
   introChapters?: Array<{
      index: number;
      title: string;
      slug: string;
      text: string;
      summary?: string;
   }>;
   entries: CatalogEntryChunk[];
   annexChapters?: Array<{
      index: number;
      title: string;
      slug: string;
      text: string;
      summary?: string;
   }>;
}

/**
 * Ingests a structured catalog or encyclopedic monograph into a coherent OKF v0.2 collection.
 * Decoupled from specific model providers and composable with domain taxonomy profiles.
 */
export async function ingestCatalogMonograph(
   input: CatalogMonographInput,
   options: CatalogIngestionOptions
): Promise<CatalogIngestionSummary> {
   const bookSlug = slugify(input.bookTitle);
   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
   const soa = options.soa || 'quatrain/knowledge';
   const revision = options.revision;
   const profile = options.taxonomyProfile || new GenericDomainProfile();
   const targetLanguages = options.targetLanguages || options.languages || profile.targetLanguages || ['en'];

   const parentBook: CatalogParentBookRef = {
      title: input.bookTitle,
      slug: bookSlug,
      resource: options.originalFileUri,
      fileHash: options.fileHash,
      authors: input.authors,
      publisher: input.publisher,
      publicationYear: input.publicationYear,
      edition: input.edition,
   };

   // 1. Prepare target filesystem structure
   const bookRelativeFolder = path.join('content', input.category, bookSlug);
   const absoluteBookFolder = path.join(options.gitLocalPath, bookRelativeFolder);
   const entriesRelativeFolder = path.join(bookRelativeFolder, 'entries');
   const absoluteEntriesFolder = path.join(options.gitLocalPath, entriesRelativeFolder);

   await fs.mkdir(absoluteBookFolder, { recursive: true });
   await fs.mkdir(absoluteEntriesFolder, { recursive: true });

   const allCreatedFiles: string[] = [];
   const processedEntries: CatalogEntryResult[] = [];
   const processedIntroChapters: BookOutlineChapter[] = [];

   let totalPromptTokens = 0;
   let totalCandidatesTokens = 0;
   let totalThinkingTokens = 0;
   let totalCostUsd = 0;
   let totalDiagrams = 0;
   let totalTables = 0;

   // 2. Process Introductory / Methodology Chapters
   if (input.introChapters && input.introChapters.length > 0) {
      for (const ch of input.introChapters) {
         const chapterResult = await extractSemanticContent(
            {
               rawText: ch.text,
               filename: `${options.filename} - Chapter ${ch.index}: ${ch.title}`,
            },
            options.apiKey,
            {
               model,
               adapter: options.adapter,
               runner: options.runner,
               taxonomyProfile: profile,
               defaultCategory: input.category,
               targetLanguages,
               contextNote: `Introductory / methodological section of encyclopedic monograph "${input.bookTitle}".
Chapter ${ch.index}: "${ch.title}".`,
            }
         );

         totalPromptTokens += chapterResult.usage.prompt;
         totalCandidatesTokens += chapterResult.usage.candidates;
         totalThinkingTokens += chapterResult.usage.thinking;
         totalCostUsd += chapterResult.usage.costUsd;
         totalDiagrams += chapterResult.diagramsTranscribed;
         totalTables += chapterResult.tablesTranscribed;

         const chapterMetadata: OkfFrontmatterV2 = {
            type: 'chapter',
            title: `Chapter ${ch.index}: ${chapterResult.metadata.title || ch.title}`,
            description: chapterResult.metadata.description || ch.summary || `Chapter ${ch.index} of ${input.bookTitle}.`,
            tags: Array.from(new Set([...(chapterResult.metadata.tags || []), bookSlug])),
            status: 'draft',
            generated: {
               by: `quatrain/okf-ingest-catalog (${model})`,
               at: new Date().toISOString(),
               tokens: chapterResult.usage,
            },
            sources: [
               {
                  id: 'parent-book',
                  resource: options.originalFileUri,
                  title: input.bookTitle,
                  fileHash: options.fileHash,
               },
            ],
            soa,
            revision,
            category: input.category,
            language: chapterResult.metadata.language || input.language || 'fr',
            originalLanguage: chapterResult.metadata.originalLanguage || input.originalLanguage || 'fr',
            abstracts: chapterResult.metadata.abstracts,
            keywords: chapterResult.metadata.keywords,
            thematics: chapterResult.metadata.thematics,
            soils: chapterResult.metadata.soils,
            climates: chapterResult.metadata.climates,
            itineraries: chapterResult.metadata.itineraries,
            crops: chapterResult.metadata.crops,
            authors: input.authors,
            publisher: input.publisher,
            publicationYear: input.publicationYear,
         };

         const chapterRelPath = path.join(bookRelativeFolder, `${ch.slug}.md`);
         const absoluteChapterPath = path.join(options.gitLocalPath, chapterRelPath);
         const content = serializeOkfDocument(chapterMetadata, chapterResult.body);
         await fs.writeFile(absoluteChapterPath, content, 'utf-8');

         allCreatedFiles.push(chapterRelPath);
         processedIntroChapters.push({
            index: ch.index,
            title: ch.title,
            slug: ch.slug,
            summary: ch.summary || chapterResult.metadata.description,
         });
      }
   }

   // 3. Process Atomic Catalog Entries
   let currentEntry = 0;
   const totalEntries = input.entries.length;

   for (const entryChunk of input.entries) {
      currentEntry++;
      if (options.onProgress) {
         options.onProgress(currentEntry, totalEntries, entryChunk.rawTitle);
      }

      const entryResult = await extractCatalogEntryContent(entryChunk, {
         apiKey: options.apiKey,
         adapter: options.adapter,
         runner: options.runner,
         parentBook,
         entryType: options.entryType || 'catalog-entry',
         model,
         defaultCategory: input.category,
         soa,
         revision,
         taxonomyProfile: profile,
         targetLanguages,
      });

      totalPromptTokens += entryResult.usage.prompt;
      totalCandidatesTokens += entryResult.usage.candidates;
      totalThinkingTokens += entryResult.usage.thinking;
      totalCostUsd += entryResult.usage.costUsd;
      totalDiagrams += entryResult.diagramsTranscribed;
      totalTables += entryResult.tablesTranscribed;

      // Semantic slug derived from Latin / scientific name or clean title
      const entryNamingSeed =
         entryResult.metadata.scientificName ||
         entryChunk.scientificName ||
         entryResult.metadata.title ||
         entryChunk.rawTitle;
      const cleanSlugName = slugify(entryNamingSeed);
      const finalEntrySlug = `${String(entryChunk.sequence).padStart(3, '0')}-${cleanSlugName}`;

      const entryRelPath = path.join(entriesRelativeFolder, `${finalEntrySlug}.md`);
      const absoluteEntryPath = path.join(options.gitLocalPath, entryRelPath);
      const entrySerialized = serializeOkfDocument(entryResult.metadata, entryResult.body);
      await fs.writeFile(absoluteEntryPath, entrySerialized, 'utf-8');

      allCreatedFiles.push(entryRelPath);
      processedEntries.push({
         sequence: entryChunk.sequence,
         slug: finalEntrySlug,
         metadata: entryResult.metadata,
         body: entryResult.body,
         relativePath: entryRelPath,
         usage: entryResult.usage,
         diagramsTranscribed: entryResult.diagramsTranscribed,
         tablesTranscribed: entryResult.tablesTranscribed,
      });
   }

   // 4. Construct Master index.md
   const aggregatedUsage: OkfTokenUsage = {
      prompt: totalPromptTokens,
      candidates: totalCandidatesTokens,
      thinking: totalThinkingTokens,
      total: totalPromptTokens + totalCandidatesTokens + totalThinkingTokens,
      costUsd: Number(totalCostUsd.toFixed(6)),
   };

   const masterAbstracts: Record<string, string> = {};
   const masterKeywords: Record<string, string[]> = {};

   for (const lang of targetLanguages) {
      if (lang === 'fr') {
         masterAbstracts.fr = input.description;
         masterKeywords.fr = [input.bookTitle, 'catalogue', 'encyclopedie'];
      } else if (lang === 'en') {
         masterAbstracts.en = `Encyclopedic catalog titled "${input.bookTitle}" containing ${processedEntries.length} atomic entries and reference chapters.`;
         masterKeywords.en = [input.bookTitle, 'catalog', 'encyclopedia'];
      } else if (lang === 'ar') {
         masterAbstracts.ar = `دليل وموسوعة مرجعية بعنوان "${input.bookTitle}" تضم ${processedEntries.length} مدخل مفصل وفصول منهجية.`;
         masterKeywords.ar = [input.bookTitle, 'دليل', 'موسوعة'];
      } else {
         Reflect.set(masterAbstracts, lang, input.description);
         Reflect.set(masterKeywords, lang, [input.bookTitle, 'catalog']);
      }
   }

   const masterMetadata: OkfFrontmatterV2 = {
      type: 'monograph',
      title: input.bookTitle,
      description: input.description,
      tags: Array.from(new Set([...(input.tags || ['catalog', 'encyclopedia']), bookSlug])),
      status: 'draft',
      generated: {
         by: `quatrain/okf-ingest-catalog (${model})`,
         at: new Date().toISOString(),
         tokens: aggregatedUsage,
      },
      sources: [
         {
            id: 'original-file',
            resource: options.originalFileUri,
            title: options.filename,
            fileHash: options.fileHash,
         },
      ],
      soa,
      revision,
      category: input.category,
      authors: input.authors,
      publisher: input.publisher,
      publicationYear: input.publicationYear,
      edition: input.edition,
      language: input.language || targetLanguages[0] || 'en',
      originalLanguage: input.originalLanguage || input.language || targetLanguages[0] || 'en',
      abstracts: masterAbstracts,
      keywords: masterKeywords,
   };

   let masterBody = `# ${input.bookTitle}\n\n${input.description}\n\n`;

   if (processedIntroChapters.length > 0) {
      masterBody += `## I. Methodological Guides & Foundational Chapters\n\n`;
      for (const ch of processedIntroChapters) {
         masterBody += `- [**Chapter ${ch.index}: ${ch.title}**](./${ch.slug}.md)\n`;
         if (ch.summary) {
            masterBody += `  *${ch.summary}*\n`;
         }
      }
      masterBody += `\n`;
   }

   if (processedEntries.length > 0) {
      masterBody += `## II. Sequential Entry Catalog (${processedEntries.length} entries)\n\n`;
      masterBody += `| N° | Entry Title | Scientific / Canonical Name | Family / Group | Detailed Record |\n`;
      masterBody += `|:---:|:---|:---|:---|:---|\n`;

      for (const entry of processedEntries) {
         const meta = entry.metadata;
         const seqStr = String(entry.sequence).padStart(3, '0');
         const latinStr = meta.scientificName ? `*${meta.scientificName}*` : '—';
         const famStr = meta.family || '—';
         masterBody += `| ${seqStr} | **${meta.title}** | ${latinStr} | ${famStr} | [View record](./entries/${entry.slug}.md) |\n`;
      }
      masterBody += `\n`;
   }

   const masterIndexPath = path.join(bookRelativeFolder, 'index.md');
   const absoluteMasterIndexPath = path.join(options.gitLocalPath, masterIndexPath);
   const masterContent = serializeOkfDocument(masterMetadata, masterBody);
   await fs.writeFile(absoluteMasterIndexPath, masterContent, 'utf-8');
   allCreatedFiles.push(masterIndexPath);

   return {
      bookSlug,
      bookTitle: input.bookTitle,
      masterIndexPath,
      totalEntries: processedEntries.length,
      totalChapters: processedIntroChapters.length,
      createdFiles: allCreatedFiles,
      usage: aggregatedUsage,
      totalDiagrams,
      totalTables,
   };
}
