import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveAiAdapter } from './adapter';
import { extractSemanticContent } from './ai';
import { calculateTokenCost, RawTokenUsageMetadata } from './cost';
import { GenericDomainProfile } from './profiles/generic';
import { buildBookOutlinePrompt } from './prompts/outlinePrompt';
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
   OkfJsonSchema,
   OkfJsonSchemaProperty,
   OkfMultilingualContent,
   OkfMultilingualKeywords,
   OkfSourceEntry,
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
 * Builds a JSON Schema for book outline discovery, merging universal fields,
 * domain extensions, and configurable target languages.
 */
export function buildBookOutlineSchema(
   profile?: DomainTaxonomyProfile,
   languages: string[] = ['en']
): OkfJsonSchema {
   const abstractProps: Record<string, OkfJsonSchemaProperty> = Object.fromEntries(
      languages.map((lang) => [lang, { type: 'STRING' }])
   );
   const keywordProps: Record<string, OkfJsonSchemaProperty> = Object.fromEntries(
      languages.map((lang) => [lang, { type: 'ARRAY', items: { type: 'STRING' } }])
   );

   const properties: Record<string, OkfJsonSchemaProperty> = {
      title: { type: 'STRING' },
      description: { type: 'STRING' },
      category: { type: 'STRING' },
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
      tags: {
         type: 'ARRAY',
         items: { type: 'STRING' },
      },
      chapters: {
         type: 'ARRAY',
         items: {
            type: 'OBJECT',
            properties: {
               index: { type: 'INTEGER' },
               title: { type: 'STRING' },
               summary: { type: 'STRING' },
               startMarker: { type: 'STRING' },
               endMarker: { type: 'STRING' },
            },
            required: ['index', 'title', 'summary'],
         },
      },
      ...(profile?.schemaProperties as Record<string, OkfJsonSchemaProperty> | undefined),
   };

   return {
      type: 'OBJECT',
      properties,
      required: ['title', 'description', 'category', 'tags', 'chapters', 'language', 'abstracts', 'keywords'],
   };
}

export const BOOK_OUTLINE_AI_SCHEMA: OkfJsonSchema = buildBookOutlineSchema();

/**
 * Discovers the structural outline, table of contents and chapter boundaries of a large book or monograph.
 * Decoupled from specific model providers and delegates strictly through @quatrain/ai adapters.
 */
export async function extractBookOutline(
   rawText: string,
   filename: string,
   apiKey?: string,
   options: MonographOptions = {}
): Promise<{ outline: BookOutline; usage: OkfTokenUsage }> {
   const adapter = resolveAiAdapter({ adapter: options.adapter, apiKey: apiKey || options.apiKey });
   const profile = options.taxonomyProfile || new GenericDomainProfile();
   const targetLanguages = options.targetLanguages || options.languages || profile.targetLanguages || ['en'];
   const schema = buildBookOutlineSchema(profile, targetLanguages);
   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

   const headLength = 35_000;
   const tailLength = 10_000;
   let sampleText = rawText;
   if (rawText.length > headLength + tailLength) {
      sampleText = `${rawText.substring(0, headLength)}\n\n[... intermediate voluminous book content omitted ...]\n\n${rawText.substring(rawText.length - tailLength)}`;
   }

   const prompt = buildBookOutlinePrompt({ filename, sampleText, languages: targetLanguages }, profile);

   const usageHolder: { usage: RawTokenUsageMetadata | null } = { usage: null };
   const parsed = (await adapter.generateStructured(prompt, schema, {
      model,
      onUsage: (u: unknown) => {
         if (typeof u === 'object' && u !== null) {
            usageHolder.usage = u as RawTokenUsageMetadata;
         }
      },
   })) as Record<string, unknown>;

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
      language: typeof parsed.language === 'string' ? parsed.language : targetLanguages[0] || 'en',
      originalLanguage:
         typeof parsed.originalLanguage === 'string'
            ? parsed.originalLanguage
            : typeof parsed.language === 'string'
              ? parsed.language
              : targetLanguages[0] || 'en',
      abstracts: Object.keys(abstracts).length > 0 ? abstracts : undefined,
      keywords: Object.keys(keywords).length > 0 ? keywords : undefined,
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
   for (const [i, ch] of chapters.entries()) {
      let pos = -1;

      if (ch.startMarker && ch.startMarker.length > 8) {
         pos = rawText.indexOf(ch.startMarker);
         if (pos === -1) {
            const shortMarker = ch.startMarker.slice(0, 30);
            pos = rawText.indexOf(shortMarker);
         }
      }

      if (pos === -1 && ch.title) {
         const lowerText = rawText.toLowerCase();
         const lowerTitle = ch.title.toLowerCase();
         const titleIdx = lowerText.indexOf(lowerTitle);
         if (titleIdx !== -1) {
            pos = titleIdx;
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
   for (const [i, ch] of chapters.entries()) {
      const start = positions.at(i) ?? 0;
      const end = i === chapters.length - 1 ? rawText.length : (positions.at(i + 1) ?? rawText.length);
      results.push({
         chapter: ch,
         text: rawText.substring(start, end).trim(),
      });
   }

   return results;
}

export interface ChapterFrontmatterOptions {
   ch: { index: number; title: string; summary?: string };
   chapterMetadata: OkfFrontmatterV2;
   bookTitle: string;
   bookSlug: string;
   tags?: string[];
   category: string;
   generator: string;
   usage: OkfTokenUsage;
   sources: OkfSourceEntry[];
   soa?: string;
   revision?: string;
   authors?: string[];
   publisher?: string;
   publicationYear?: string | number;
   fallbackLanguage?: string;
   originalLanguage?: string;
   thematics?: string[];
   soils?: string[];
   climates?: string[];
   itineraries?: string[];
   crops?: string[];
}

export function buildChapterFrontmatter(opts: ChapterFrontmatterOptions): OkfFrontmatterV2 {
   const lang = opts.chapterMetadata.language || opts.fallbackLanguage || 'en';
   return {
      type: 'chapter',
      title: `Chapter ${opts.ch.index}: ${opts.chapterMetadata.title || opts.ch.title}`,
      description: opts.chapterMetadata.description || opts.ch.summary || `Chapter ${opts.ch.index} of ${opts.bookTitle}.`,
      tags: Array.from(new Set([...(opts.chapterMetadata.tags || []), ...(opts.tags || []), opts.bookSlug])),
      status: 'draft',
      generated: {
         by: opts.generator,
         at: new Date().toISOString(),
         tokens: opts.usage,
      },
      sources: opts.sources,
      soa: opts.soa,
      revision: opts.revision,
      category: opts.category,
      authors: opts.authors,
      publisher: opts.publisher,
      publicationYear: opts.publicationYear,
      language: lang,
      originalLanguage: opts.chapterMetadata.originalLanguage || opts.originalLanguage || lang,
      abstracts: opts.chapterMetadata.abstracts,
      keywords: opts.chapterMetadata.keywords,
      thematics: opts.chapterMetadata.thematics || opts.thematics,
      soils: opts.chapterMetadata.soils || opts.soils,
      climates: opts.chapterMetadata.climates || opts.climates,
      itineraries: opts.chapterMetadata.itineraries || opts.itineraries,
      crops: opts.chapterMetadata.crops || opts.crops,
   };
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
   const targetLanguages = options.targetLanguages || options.languages || profile.targetLanguages || ['en'];

   // 1. Direct single-doc extraction if below threshold
   if (input.rawText.length < splitThreshold) {
      const singleDoc = await extractSemanticContent(
         { rawText: input.rawText, filename: input.filename },
         apiKey,
         { ...options, taxonomyProfile: profile, targetLanguages }
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
      { ...options, taxonomyProfile: profile, targetLanguages }
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
            targetLanguages,
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

      const chapterMetadata: OkfFrontmatterV2 = buildChapterFrontmatter({
         ch,
         chapterMetadata: chapterResult.metadata,
         bookTitle: outline.title,
         bookSlug: outline.slug,
         tags: outline.tags,
         category: outline.category,
         generator: `quatrain/okf-ingest (${model})`,
         usage: chapterResult.usage,
         sources: [
            {
               id: 'parent-book',
               resource: input.originalFileUri || input.filename,
               title: outline.title,
               chapter: `Chapter ${ch.index}: ${ch.title}`,
               fileHash: input.fileHash,
            },
         ],
         soa,
         revision,
         authors: outline.authors,
         publisher: outline.publisher,
         publicationYear: outline.publicationYear,
         fallbackLanguage: outline.language || targetLanguages[0],
         originalLanguage: outline.originalLanguage || targetLanguages[0],
         thematics: outline.thematics,
         soils: outline.soils,
         climates: outline.climates,
         itineraries: outline.itineraries,
         crops: outline.crops,
      });

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
      license: outline.license,
      copyright: outline.copyright,
      language: outline.language || targetLanguages[0] || 'en',
      originalLanguage: outline.originalLanguage || outline.language || targetLanguages[0] || 'en',
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

export { decomposeAndIngestMonograph as ingestMonograph };
