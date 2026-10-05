import { Schema, Type } from '@google/genai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { extractSemanticContent } from './ai';
import { GenericDomainProfile } from './profiles/generic';
import { buildBookOutlinePrompt } from './prompts/outlinePrompt';
import { resolveStructuredRunner } from './runner';
import { serializeOkfDocument } from './serializer';
import {
   BookOutline,
   BookOutlineChapter,
   ChapterExtractionResult,
   DomainTaxonomyProfile,
   MonographIngestionResult,
   MonographInput,
   MonographOptions,
   OkfDocument,
   OkfDocumentType,
   OkfFrontmatterV2,
   OkfMultilingualContent,
   OkfMultilingualKeywords,
   OkfTokenUsage,
} from './types';

/**
 * Normalizes text into a clean lowercase URL/filesystem slug.
 */
export function slugify(text: string): string {
   return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .slice(0, 80);
}

/**
 * Builds a JSON Schema for book outline discovery, merging universal fields with domain extensions.
 */
export function buildBookOutlineSchema(profile?: DomainTaxonomyProfile): Schema {
   const properties: Record<string, Schema> = {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      category: { type: Type.STRING },
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
      tags: {
         type: Type.ARRAY,
         items: { type: Type.STRING },
      },
      chapters: {
         type: Type.ARRAY,
         items: {
            type: Type.OBJECT,
            properties: {
               index: { type: Type.INTEGER },
               title: { type: Type.STRING },
               summary: { type: Type.STRING },
               startMarker: { type: Type.STRING },
               endMarker: { type: Type.STRING },
            },
            required: ['index', 'title', 'summary'],
         },
      },
      ...((profile?.schemaProperties as Record<string, Schema>) || {}),
   };

   return {
      type: Type.OBJECT,
      properties,
      required: ['title', 'description', 'category', 'tags', 'chapters', 'language', 'abstracts', 'keywords'],
   };
}

export const BOOK_OUTLINE_AI_SCHEMA: Schema = buildBookOutlineSchema();

/**
 * Discovers the structural outline, table of contents and chapter boundaries of a large book or monograph.
 * Decoupled from specific model providers and composable with domain taxonomy profiles.
 */
export async function extractBookOutline(
   rawText: string,
   filename: string,
   apiKey?: string,
   options: MonographOptions = {}
): Promise<{ outline: BookOutline; usage: OkfTokenUsage }> {
   const runner = resolveStructuredRunner(apiKey || options.apiKey, options.runner);
   const profile = options.taxonomyProfile || new GenericDomainProfile();
   const schema = buildBookOutlineSchema(profile);
   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

   const headLength = 35_000;
   const tailLength = 10_000;
   let sampleText = rawText;
   if (rawText.length > headLength + tailLength) {
      sampleText = `${rawText.substring(0, headLength)}\n\n[... intermediate voluminous book content omitted ...]\n\n${rawText.substring(rawText.length - tailLength)}`;
   }

   const prompt = buildBookOutlinePrompt({ filename, sampleText }, profile);

   const result = await runner.generateStructured<Record<string, unknown>>(prompt, schema, { model });
   const parsed = result.data;
   const usage: OkfTokenUsage = result.usage;

   const rawChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
   const chapters: BookOutlineChapter[] = rawChapters.map((c, i) => {
      const rec = typeof c === 'object' && c !== null ? (c as Record<string, unknown>) : {};
      const title = String(rec.title || `Chapter ${i + 1}`);
      return {
         index: typeof rec.index === 'number' ? rec.index : i + 1,
         title,
         slug: `${String(i + 1).padStart(2, '0')}-${slugify(title)}`,
         summary: typeof rec.summary === 'string' ? rec.summary : undefined,
         startMarker: typeof rec.startMarker === 'string' ? rec.startMarker : undefined,
         endMarker: typeof rec.endMarker === 'string' ? rec.endMarker : undefined,
      };
   });

   const domainMeta = profile.extractDomainMetadata ? profile.extractDomainMetadata(parsed) : {};
   const fallbackTitle = path.basename(filename, path.extname(filename));

   const outline: BookOutline = {
      title: typeof parsed.title === 'string' ? parsed.title : fallbackTitle,
      slug: slugify(typeof parsed.title === 'string' ? parsed.title : fallbackTitle),
      description: typeof parsed.description === 'string' ? parsed.description : 'Monograph publication.',
      category:
         typeof parsed.category === 'string'
            ? parsed.category
            : (options.defaultCategory || profile.defaultCategory || 'books'),
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
      tags:
         Array.isArray(parsed.tags) && parsed.tags.length > 0
            ? (parsed.tags as string[])
            : (profile.defaultTags || ['monograph', 'book']),
      chapters,
      ...domainMeta,
   };

   return { outline, usage };
}

/**
 * Slices full book text into distinct chapter chunks using discovered anchor markers or proportional distribution.
 */
export function sliceTextByChapters(
   rawText: string,
   chapters: BookOutlineChapter[]
): Array<{ chapter: BookOutlineChapter; text: string }> {
   if (chapters.length === 0) {
      return [
         {
            chapter: { index: 1, title: 'Complete Document', slug: '01-complete-document' },
            text: rawText,
         },
      ];
   }

   if (chapters.length === 1) {
      return [{ chapter: chapters[0], text: rawText }];
   }

   const positions: number[] = [];
   for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      let pos = -1;

      if (ch.startMarker && ch.startMarker.length > 8) {
         pos = rawText.indexOf(ch.startMarker);
         if (pos === -1) {
            const shortMarker = ch.startMarker.slice(0, 30);
            pos = rawText.indexOf(shortMarker);
         }
      }

      if (pos === -1 && ch.title) {
         const regex = new RegExp(`(?:chapitre|chapter|partie|part)?\\s*${ch.index}?\\s*[:.-]?\\s*${ch.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
         const m = rawText.match(regex);
         if (m && m.index !== undefined) {
            pos = m.index;
         }
      }

      positions.push(pos);
   }

   // Validate strictly monotonic positions
   let isMonotonic = true;
   let lastPos = -1;
   for (const p of positions) {
      if (p === -1 || p <= lastPos) {
         isMonotonic = false;
         break;
      }
      lastPos = p;
   }

   if (!isMonotonic) {
      // Fallback: Proportional distribution
      const totalLen = rawText.length;
      const sliceSize = Math.floor(totalLen / chapters.length);
      return chapters.map((ch, idx) => {
         const start = idx * sliceSize;
         const end = idx === chapters.length - 1 ? totalLen : (idx + 1) * sliceSize;
         return {
            chapter: ch,
            text: rawText.substring(start, end).trim(),
         };
      });
   }

   const results: Array<{ chapter: BookOutlineChapter; text: string }> = [];
   for (let i = 0; i < chapters.length; i++) {
      const start = positions[i];
      const end = i === chapters.length - 1 ? rawText.length : positions[i + 1];
      results.push({
         chapter: chapters[i],
         text: rawText.substring(start, end).trim(),
      });
   }

   return results;
}

/**
 * High-level monograph decomposition engine.
 * Discovers structural outline, slices content into chapters, extracts semantic units,
 * generates standard OKF v0.2 fiches, and constructs the master index.
 */
export async function decomposeAndIngestMonograph(
   input: MonographInput,
   apiKey?: string,
   options: MonographOptions = {}
): Promise<MonographIngestionResult> {
   const splitThreshold = options.splitThresholdChars || 60_000;
   const profile = options.taxonomyProfile || new GenericDomainProfile();

   // 1. Direct single-doc extraction if below threshold
   if (input.rawText.length < splitThreshold) {
      const singleDoc = await extractSemanticContent(
         { rawText: input.rawText, filename: input.filename },
         apiKey,
         { ...options, taxonomyProfile: profile }
      );

      const docSlug = slugify(singleDoc.metadata.title);
      const relativePath = path.join(
         'content',
         singleDoc.metadata.category || profile.defaultCategory || 'general',
         `${docSlug}.md`
      );
      const absolutePath = path.join(input.gitLocalPath, relativePath);

      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      const serialized = serializeOkfDocument(singleDoc.metadata, singleDoc.body);
      await fs.writeFile(absolutePath, serialized, 'utf-8');

      return {
         masterDoc: { ...singleDoc, relativePath },
         masterRelativePath: relativePath,
         chapterDocs: [],
         allCreatedFiles: [relativePath],
         folderPath: path.dirname(relativePath),
         totalTokens: singleDoc.usage,
         totalCostUsd: singleDoc.usage.costUsd,
         totalDiagrams: singleDoc.diagramsTranscribed,
         totalTables: singleDoc.tablesTranscribed,
      };
   }

   // 2. Discover outline for large monographs
   const { outline, usage: outlineUsage } = await extractBookOutline(
      input.rawText,
      input.filename,
      apiKey,
      { ...options, taxonomyProfile: profile }
   );

   const slices = sliceTextByChapters(input.rawText, outline.chapters);
   const folderPath = path.join('content', outline.category, outline.slug);
   const absoluteFolder = path.join(input.gitLocalPath, folderPath);

   await fs.mkdir(absoluteFolder, { recursive: true });

   const chapterDocs: ChapterExtractionResult[] = [];
   const allCreatedFiles: string[] = [];

   let totalPromptTokens = outlineUsage.prompt;
   let totalCandidatesTokens = outlineUsage.candidates;
   let totalThinkingTokens = outlineUsage.thinking;
   let totalCostUsd = outlineUsage.costUsd;
   let totalDiagrams = 0;
   let totalTables = 0;

   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
   const soa = options.soa || 'quatrain/knowledge';
   const revision = options.revision;

   for (const slice of slices) {
      const ch = slice.chapter;
      const chapterResult = await extractSemanticContent(
         {
            rawText: slice.text,
            filename: `${input.filename} - Chapter ${ch.index}: ${ch.title}`,
         },
         apiKey,
         {
            ...options,
            taxonomyProfile: profile,
            defaultCategory: outline.category,
            contextNote: `This text is Chapter ${ch.index} ("${ch.title}") of the book "${outline.title}".
Extract specifically the concepts, taxonomies, diagrams, and tables relevant to this chapter.`,
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
         description:
            chapterResult.metadata.description || ch.summary || `Chapter ${ch.index} of ${outline.title}.`,
         tags: Array.from(new Set([...(chapterResult.metadata.tags || []), ...(outline.tags || []), outline.slug])),
         status: 'draft',
         generated: {
            by: `quatrain/okf-ingest (${model})`,
            at: new Date().toISOString(),
            tokens: chapterResult.usage,
         },
         sources: [
            {
               id: 'parent-book',
               resource: input.originalFileUri,
               title: outline.title,
               chapter: `Chapter ${ch.index}: ${ch.title}`,
               fileHash: input.fileHash,
            },
         ],
         soa,
         revision,
         category: outline.category,
         authors: outline.authors,
         publisher: outline.publisher,
         publicationYear: outline.publicationYear,
         language: chapterResult.metadata.language || outline.language || 'fr',
         originalLanguage: chapterResult.metadata.originalLanguage || outline.originalLanguage || 'fr',
         abstracts: chapterResult.metadata.abstracts,
         keywords: chapterResult.metadata.keywords,
         thematics: chapterResult.metadata.thematics || outline.thematics,
         soils: chapterResult.metadata.soils || outline.soils,
         climates: chapterResult.metadata.climates || outline.climates,
         itineraries: chapterResult.metadata.itineraries || outline.itineraries,
         crops: chapterResult.metadata.crops || outline.crops,
      };

      const chapterRelativePath = path.join(folderPath, `${ch.slug}.md`);
      const absoluteChapterPath = path.join(input.gitLocalPath, chapterRelativePath);
      const chapterContent = serializeOkfDocument(chapterMetadata, chapterResult.body);
      await fs.writeFile(absoluteChapterPath, chapterContent, 'utf-8');

      allCreatedFiles.push(chapterRelativePath);
      chapterDocs.push({
         index: ch.index,
         title: ch.title,
         slug: ch.slug,
         relativePath: chapterRelativePath,
         doc: { metadata: chapterMetadata, body: chapterResult.body, relativePath: chapterRelativePath },
         usage: chapterResult.usage,
         diagramsTranscribed: chapterResult.diagramsTranscribed,
         tablesTranscribed: chapterResult.tablesTranscribed,
      });
   }

   const aggregatedTokens: OkfTokenUsage = {
      prompt: totalPromptTokens,
      candidates: totalCandidatesTokens,
      thinking: totalThinkingTokens,
      total: totalPromptTokens + totalCandidatesTokens + totalThinkingTokens,
      costUsd: Number(totalCostUsd.toFixed(6)),
   };

   // Master Index Document
   const masterMetadata: OkfFrontmatterV2 = {
      type: 'monograph',
      title: outline.title,
      description: outline.description,
      tags: outline.tags,
      status: 'draft',
      generated: {
         by: `quatrain/okf-ingest (${model})`,
         at: new Date().toISOString(),
         tokens: aggregatedTokens,
      },
      sources: [
         {
            id: 'original-file',
            resource: input.originalFileUri,
            title: input.filename,
            fileHash: input.fileHash,
         },
      ],
      soa,
      revision,
      category: outline.category,
      thematics: outline.thematics,
      soils: outline.soils,
      climates: outline.climates,
      itineraries: outline.itineraries,
      crops: outline.crops,
      authors: outline.authors,
      publisher: outline.publisher,
      publicationYear: outline.publicationYear,
      language: outline.language || 'fr',
      originalLanguage: outline.originalLanguage || outline.language || 'fr',
      abstracts: outline.abstracts,
      keywords: outline.keywords,
   };

   const masterBody = `# ${outline.title}

${outline.description}

## Table of Contents & Analyzed Chapters

${chapterDocs
   .map(
      (c) =>
         `- [**Chapter ${c.index}: ${c.title}**](./${c.slug}.md)\n  *${c.doc.metadata.description}*`
   )
   .join('\n\n')}
`;

   const masterRelativePath = path.join(folderPath, 'index.md');
   const absoluteMasterPath = path.join(input.gitLocalPath, masterRelativePath);
   const masterContent = serializeOkfDocument(masterMetadata, masterBody);
   await fs.writeFile(absoluteMasterPath, masterContent, 'utf-8');
   allCreatedFiles.unshift(masterRelativePath);

   const masterDoc: OkfDocument = {
      metadata: masterMetadata,
      body: masterBody,
      relativePath: masterRelativePath,
   };

   return {
      masterDoc,
      masterRelativePath,
      chapterDocs,
      allCreatedFiles,
      folderPath,
      totalTokens: aggregatedTokens,
      totalCostUsd,
      totalDiagrams,
      totalTables,
   };
}
