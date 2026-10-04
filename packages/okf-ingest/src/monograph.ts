import { GoogleGenAI, Schema, Type } from '@google/genai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { extractSemanticContent } from './ai';
import { calculateTokenCost } from './cost';
import { serializeOkfDocument } from './serializer';
import {
   BookOutline,
   BookOutlineChapter,
   ChapterExtractionResult,
   MonographIngestionResult,
   MonographInput,
   MonographOptions,
   OkfDocument,
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

export const BOOK_OUTLINE_AI_SCHEMA: Schema = {
   type: Type.OBJECT,
   properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      category: { type: Type.STRING },
      authors: {
         type: Type.ARRAY,
         items: { type: Type.STRING },
      },
      publisher: { type: Type.STRING },
      publicationYear: { type: Type.STRING },
      language: { type: Type.STRING }, // ISO 639-1 (e.g. "fr", "en", "es", "ar")
      originalLanguage: { type: Type.STRING },
      abstracts: {
         type: Type.OBJECT,
         properties: {
            en: { type: Type.STRING },
            ar: { type: Type.STRING },
         },
         required: ['en', 'ar'],
      },
      keywords: {
         type: Type.OBJECT,
         properties: {
            en: {
               type: Type.ARRAY,
               items: { type: Type.STRING },
            },
            ar: {
               type: Type.ARRAY,
               items: { type: Type.STRING },
            },
         },
         required: ['en', 'ar'],
      },
      thematics: {
         type: Type.ARRAY,
         items: { type: Type.STRING },
      },
      soils: {
         type: Type.ARRAY,
         items: { type: Type.STRING },
      },
      climates: {
         type: Type.ARRAY,
         items: { type: Type.STRING },
      },
      itineraries: {
         type: Type.ARRAY,
         items: { type: Type.STRING },
      },
      crops: {
         type: Type.ARRAY,
         items: { type: Type.STRING },
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
   },
   required: ['title', 'description', 'category', 'tags', 'chapters', 'language', 'abstracts', 'keywords'],
};

/**
 * Discovers the structural outline, table of contents and chapter boundaries of a large book or monograph.
 *
 * @param rawText - Raw textual content extracted from the document.
 * @param filename - Source document filename.
 * @param apiKey - Gemini API authentication key.
 * @param options - Extraction parameters and model configuration.
 * @returns Parsed BookOutline and exact token usage.
 */
export async function extractBookOutline(
   rawText: string,
   filename: string,
   apiKey: string,
   options: MonographOptions = {}
): Promise<{ outline: BookOutline; usage: OkfTokenUsage }> {
   const ai = new GoogleGenAI({ apiKey });
   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

   // Build a representative excerpt containing title, preface, detailed table of contents, and conclusion
   const headLength = 35_000;
   const tailLength = 10_000;
   let sampleText = rawText;
   if (rawText.length > headLength + tailLength) {
      sampleText = `${rawText.substring(0, headLength)}\n\n[... contenu intermédiaire du livre ...]\n\n${rawText.substring(rawText.length - tailLength)}`;
   }

   const prompt = `Tu es un ingénieur expert en structuration de connaissances pour le format Open Knowledge Format (OKF v0.2).
Analyse ce livre ou cette monographie volumineuse (${filename}) pour identifier son plan d'ensemble et découper son contenu en chapitres logiques autonomes.

Consignes strictes :
1. "title" : Titre officiel et complet de l'ouvrage (sans extension).
2. "description" : Résumé global d'une phrase concise sur la portée et l'objet de l'ouvrage dans sa langue originale.
3. "category" : Chemin de dossier en minuscules slugifiées (ex: soil-health, cover-crops, agriculture, viticulture, agronomie-livres).
4. "language" : Code ISO 639-1 de la langue principale (ex: "fr", "en", "es", "de", "ar").
5. "originalLanguage" : Code ISO 639-1 de la langue d'origine de l'ouvrage.
6. "abstracts" : Synthèse globale dense de l'ouvrage (2 à 3 phrases) :
   - "en" : Abstract en anglais scientifique soigné.
   - "ar" : Abstract en arabe agronomique soigné (الفصحى).
7. "keywords" : Mots-clés normalisés pour l'indexation :
   - "en" : 4 à 8 mots-clés en anglais.
   - "ar" : 4 à 8 mots-clés en arabe.
8. Taxonomies globales (selon pertinence de l'ouvrage) :
   - "soils", "climates", "itineraries", "crops", "thematics", "tags", "authors", "publisher", "publicationYear".
9. "chapters" : Liste ordonnée des chapitres ou grandes parties logiques (généralement entre 3 et 12 chapitres).
   - "index" : Numéro du chapitre (1, 2, 3...).
   - "title" : Titre explicite du chapitre.
   - "summary" : Synthèse concise de 1 à 2 phrases de ce que traite ce chapitre.
   - "startMarker" : Extrait textuel exact de 5 à 10 mots consécutifs au tout début de ce chapitre dans le texte ci-dessous pour repérer son ancre.
   - "endMarker" : Extrait textuel exact de 5 à 10 mots consécutifs vers la fin de ce chapitre.

Extrait représentatif de l'ouvrage :
---
${sampleText}
---`;

   const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
         responseMimeType: 'application/json',
         responseSchema: BOOK_OUTLINE_AI_SCHEMA,
      },
   });

   if (!response.text) {
      throw new Error('[OKF Ingest] No response text returned from Gemini for book outline');
   }

   const parsed = JSON.parse(response.text) as Record<string, unknown>;
   const usage: OkfTokenUsage = calculateTokenCost(response.usageMetadata, model);

   const rawChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];
   const chapters: BookOutlineChapter[] = rawChapters.map((c, i) => {
      const rec = typeof c === 'object' && c !== null ? (c as Record<string, unknown>) : {};
      const title = String(rec.title || `Chapitre ${i + 1}`);
      return {
         index: typeof rec.index === 'number' ? rec.index : i + 1,
         title,
         slug: `${String(i + 1).padStart(2, '0')}-${slugify(title)}`,
         summary: typeof rec.summary === 'string' ? rec.summary : undefined,
         startMarker: typeof rec.startMarker === 'string' ? rec.startMarker : undefined,
         endMarker: typeof rec.endMarker === 'string' ? rec.endMarker : undefined,
      };
   });

   const outline: BookOutline = {
      title: typeof parsed.title === 'string' ? parsed.title : path.basename(filename, path.extname(filename)),
      slug: slugify(typeof parsed.title === 'string' ? parsed.title : path.basename(filename, path.extname(filename))),
      description: typeof parsed.description === 'string' ? parsed.description : 'Monographie agronomique.',
      category: typeof parsed.category === 'string' ? parsed.category : (options.defaultCategory || 'agronomie-livres'),
      authors: Array.isArray(parsed.authors) ? (parsed.authors as string[]) : undefined,
      publisher: typeof parsed.publisher === 'string' ? parsed.publisher : undefined,
      publicationYear: typeof parsed.publicationYear === 'string' ? parsed.publicationYear : undefined,
      language: typeof parsed.language === 'string' ? parsed.language : 'fr',
      originalLanguage: typeof parsed.originalLanguage === 'string' ? parsed.originalLanguage : (typeof parsed.language === 'string' ? parsed.language : 'fr'),
      abstracts: typeof parsed.abstracts === 'object' && parsed.abstracts !== null ? (parsed.abstracts as OkfMultilingualContent) : undefined,
      keywords: typeof parsed.keywords === 'object' && parsed.keywords !== null ? (parsed.keywords as OkfMultilingualKeywords) : undefined,
      thematics: Array.isArray(parsed.thematics) ? (parsed.thematics as string[]) : undefined,
      soils: Array.isArray(parsed.soils) ? (parsed.soils as string[]) : undefined,
      climates: Array.isArray(parsed.climates) ? (parsed.climates as string[]) : undefined,
      itineraries: Array.isArray(parsed.itineraries) ? (parsed.itineraries as string[]) : undefined,
      crops: Array.isArray(parsed.crops) ? (parsed.crops as string[]) : undefined,
      tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]) : ['monographie', 'livre'],
      chapters,
   };

   return { outline, usage };
}

/**
 * Slices full book text into distinct chapter chunks using discovered anchor markers or proportional distribution.
 *
 * @param rawText - Complete raw textual content of the book.
 * @param chapters - Structured outline chapters.
 * @returns Array of chapter metadata coupled with their corresponding sliced text.
 */
export function sliceTextByChapters(
   rawText: string,
   chapters: BookOutlineChapter[]
): Array<{ chapter: BookOutlineChapter; text: string }> {
   if (chapters.length === 0) {
      return [
         {
            chapter: { index: 1, title: 'Document Intégral', slug: '01-document-integral' },
            text: rawText,
         },
      ];
   }

   if (chapters.length === 1) {
      return [{ chapter: chapters[0], text: rawText }];
   }

   // Locate start index for each chapter in rawText
   const positions: number[] = [];
   for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      let pos = -1;

      // 1. Try startMarker
      if (ch.startMarker && ch.startMarker.length >= 5) {
         pos = rawText.indexOf(ch.startMarker);
         if (pos === -1) {
            // Fuzzy fallback: try first 15 chars of startMarker
            pos = rawText.indexOf(ch.startMarker.substring(0, 15));
         }
      }

      // 2. Try exact chapter title
      if (pos === -1 && ch.title) {
         pos = rawText.indexOf(ch.title);
      }

      // 3. Fallback: proportional positioning
      if (pos === -1 || (positions.length > 0 && pos <= positions[positions.length - 1])) {
         const expectedRatio = i / chapters.length;
         pos = Math.floor(rawText.length * expectedRatio);
      }

      positions.push(pos);
   }

   const results: Array<{ chapter: BookOutlineChapter; text: string }> = [];
   for (let i = 0; i < chapters.length; i++) {
      const start = positions[i];
      const end = i < chapters.length - 1 ? positions[i + 1] : rawText.length;
      const text = rawText.substring(start, end).trim();
      results.push({
         chapter: chapters[i],
         text: text.length > 0 ? text : rawText.substring(start, Math.min(start + 5000, rawText.length)),
      });
   }

   return results;
}

/**
 * Ingests a large book or monograph (> 80k chars) into a cohesive folder of OKF v0.2 fiches:
 * - content/<category>/<bookSlug>/index.md (Master monograph index linking chapters)
 * - content/<category>/<bookSlug>/01-<chapterSlug>.md
 * - content/<category>/<bookSlug>/02-<chapterSlug>.md
 *
 * @param input - Monograph input payload with file details and local git repository path.
 * @param apiKey - Gemini API authentication key.
 * @param options - Ingestion options.
 * @returns MonographIngestionResult with aggregated metrics and file paths.
 */
export async function ingestMonograph(
   input: MonographInput,
   apiKey: string,
   options: MonographOptions = {}
): Promise<MonographIngestionResult> {
   const { outline, usage: outlineUsage } = await extractBookOutline(input.rawText, input.filename, apiKey, options);
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
   const soa = options.soa || 'bradtech/world-agronomy';
   const revision = options.revision;

   for (const slice of slices) {
      const ch = slice.chapter;
      const chapterResult = await extractSemanticContent(
         {
            rawText: slice.text,
            filename: `${input.filename} - Chapitre ${ch.index}: ${ch.title}`,
         },
         apiKey,
         {
            ...options,
            defaultCategory: outline.category,
            contextNote: `Ce texte est le Chapitre ${ch.index} ("${ch.title}") du livre "${outline.title}".
Extrais spécifiquement les concepts, taxonomies, schémas et tableaux propres à ce chapitre.`,
         }
      );

      totalPromptTokens += chapterResult.usage.prompt;
      totalCandidatesTokens += chapterResult.usage.candidates;
      totalThinkingTokens += chapterResult.usage.thinking;
      totalCostUsd += chapterResult.usage.costUsd;
      totalDiagrams += chapterResult.diagramsTranscribed;
      totalTables += chapterResult.tablesTranscribed;

      const chapterMetadata: OkfFrontmatterV2 = {
         type: 'chapitre',
         title: `Chapitre ${ch.index} : ${chapterResult.metadata.title || ch.title}`,
         description:
            chapterResult.metadata.description || ch.summary || `Chapitre ${ch.index} de l'ouvrage ${outline.title}.`,
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
               chapter: `Chapitre ${ch.index} : ${ch.title}`,
               fileHash: input.fileHash,
            },
         ],
         soa,
         revision,
         category: outline.category,
         thematics: chapterResult.metadata.thematics || outline.thematics,
         soils: chapterResult.metadata.soils || outline.soils,
         climates: chapterResult.metadata.climates || outline.climates,
         itineraries: chapterResult.metadata.itineraries || outline.itineraries,
         crops: chapterResult.metadata.crops || outline.crops,
         authors: outline.authors,
         publisher: outline.publisher,
         publicationYear: outline.publicationYear,
         language: chapterResult.metadata.language || outline.language || 'fr',
         originalLanguage: chapterResult.metadata.originalLanguage || outline.originalLanguage || 'fr',
         abstracts: chapterResult.metadata.abstracts,
         keywords: chapterResult.metadata.keywords,
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
      type: 'monographie',
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

## Sommaire & Chapitres Analysés

${chapterDocs
   .map(
      (c) =>
         `- [**Chapitre ${c.index} : ${c.title}**](./${c.slug}.md)\n  *${c.doc.metadata.description}*`
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
