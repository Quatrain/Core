import {
   Content,
   GenerateContentResponseUsageMetadata,
   GoogleGenAI,
   Schema,
   Type,
} from '@google/genai';
import { calculateTokenCost } from './cost';
import {
   ExtractionOptions,
   IngestionExtractionResult,
   OkfFrontmatterV2,
   OkfMultilingualContent,
   OkfMultilingualKeywords,
   OkfTokenUsage,
} from './types';

export const OKF_INGEST_AI_SCHEMA: Schema = {
   type: Type.OBJECT,
   properties: {
      title: { type: Type.STRING },
      type: { type: Type.STRING },
      description: { type: Type.STRING },
      category: { type: Type.STRING },
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
               type: { type: Type.STRING }, // mermaid | table | caption
               content: { type: Type.STRING }, // Mermaid diagram code or Markdown table
               explanation: { type: Type.STRING },
            },
            required: ['title', 'type', 'content', 'explanation'],
         },
      },
   },
   required: ['title', 'description', 'category', 'tags', 'language', 'abstracts', 'keywords'],
};

export interface AiSourceInput {
   buffer?: Buffer;
   rawText?: string;
   filename: string;
   isPdf?: boolean;
   isScanned?: boolean;
}

/**
 * Extracts semantic metadata, transcribes diagrams/tables, and computes token cost using Gemini.
 */
export async function extractSemanticContent(
   input: AiSourceInput,
   apiKey: string,
   options: ExtractionOptions = {}
): Promise<IngestionExtractionResult> {
   const ai = new GoogleGenAI({ apiKey });
   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

   const promptText = `Tu es un ingénieur expert en structuration de connaissances pour le format Open Knowledge Format (OKF v0.2).
Analyse le document ci-joint (${input.filename}) et extrais ses métadonnées, taxonomies, résumés multilingues et représentations visuelles.

Consignes strictes :
1. "title" : Titre propre, professionnel et explicite (sans extension).
2. "description" : Exactement UNE seule phrase concise résumant le document, sa portée et son utilité technique dans sa langue originale.
3. "category" : Chemin de dossier court en minuscules slugifiées (ex: soil-health, cover-crops, viticulture, agriculture, water-management, soil-amendments, formations).
4. "language" : Code ISO 639-1 obligatoire identifiant la langue du texte (ex: "fr", "en", "es", "de", "ar").
5. "originalLanguage" : Code ISO 639-1 de la langue d'origine (identique à "language" sauf si le texte indique être une traduction).
6. "abstracts" : Résumé technique concis et dense (2 à 3 phrases) dans les 3 langues suivantes :
   - "fr" : Synthèse technique en français agronomique soigné.
   - "en" : Synthèse technique en anglais scientifique soigné.
   - "ar" : Synthèse technique en arabe agronomique soigné (الفصحى).
7. "keywords" : Mots-clés normalisés pour l'indexation (4 à 8 par langue) :
   - "fr" : Mots-clés techniques en français.
   - "en" : Mots-clés techniques en anglais.
   - "ar" : Mots-clés techniques en arabe.
8. Taxonomies agronomiques (selon pertinence) :
   - "soils" : sols concernés (ex: argilo-calcaire, limoneux, sableux, vivant-microbiote).
   - "climates" : zones climatiques (ex: mediterraneen, oceanique, semi-aride, continental).
   - "itineraries" : pratiques (ex: viticulture-biologique, semis-direct, enherbement-permanent).
   - "crops" : cultures ciblées (ex: vigne, ble, colza, maraichage).
9. "diagrams" : CRITIQUE — Pour chaque schéma, organigramme, flux de travail, cycle technique ou tableau clé repéré :
   - Si c'est un flux, processus ou cycle : fournis le code Mermaid complet ("type": "mermaid", "content": "graph TD\\n...").
   - Si c'est un tableau de comparaison ou de données : fournis le tableau Markdown complet ("type": "table", "content": "| Col1 | Col2 |\\n|---|---|...").
   - Si c'est une figure visuelle complexe : fournis une description technique dense et exhaustive ("type": "caption").

${options.contextNote ? `Note contextuelle prioritaire :\n${options.contextNote}\n` : ''}`;

   // Google GenAI inlineData has a strict payload limit (~20MB base64 / ~15MB binary)
   const canSendInline = input.isScanned && input.buffer && input.isPdf && input.buffer.length <= 15 * 1024 * 1024;

   let responseText = '';
   let usageMetadata: GenerateContentResponseUsageMetadata | null | undefined = undefined;

   if (canSendInline && input.buffer) {
      const base64Data = input.buffer.toString('base64');
      const response = await ai.models.generateContent({
         model,
         contents: [
            promptText,
            {
               inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Data,
               },
            },
         ],
         config: {
            responseMimeType: 'application/json',
            responseSchema: OKF_INGEST_AI_SCHEMA,
         },
      });
      responseText = response.text || '';
      usageMetadata = response.usageMetadata;
   } else {
      const maxChars = options.maxContentChars || 80_000;
      const raw = input.rawText || '';
      let excerpt = raw;
      if (raw.length > maxChars) {
         const headLen = Math.floor(maxChars * 0.7);
         const tailLen = Math.floor(maxChars * 0.3);
         excerpt = `${raw.substring(0, headLen)}\n\n[... document intermédiaire volumineux tronqué pour analyse ...]\n\n${raw.substring(raw.length - tailLen)}`;
      }
      const response = await ai.models.generateContent({
         model,
         contents: `${promptText}\n\nExtrait du contenu texte du document :\n---\n${excerpt}\n---`,
         config: {
            responseMimeType: 'application/json',
            responseSchema: OKF_INGEST_AI_SCHEMA,
         },
      });
      responseText = response.text || '';
      usageMetadata = response.usageMetadata;
   }

   if (!responseText) {
      throw new Error('[OKF Ingest] No response text returned from Gemini API');
   }

   const parsed = JSON.parse(responseText) as Record<string, unknown>;
   const usage: OkfTokenUsage = calculateTokenCost(usageMetadata, model);

   // Build diagrams / visual synthesis section in Markdown
   const diagrams = Array.isArray(parsed.diagrams) ? parsed.diagrams : [];
   let visualMarkdown = '';
   let diagramsCount = 0;
   let tablesCount = 0;

   if (diagrams.length > 0) {
      const parts: string[] = ['\n\n## Schémas & Synthèse Visuelle\n'];
      for (const diag of diagrams) {
         parts.push(`### ${diag.title || 'Schéma'}\n`);
         if (diag.type === 'mermaid') {
            diagramsCount++;
            parts.push('```mermaid\n' + diag.content.trim() + '\n```\n');
         } else if (diag.type === 'table') {
            tablesCount++;
            parts.push(diag.content.trim() + '\n');
         } else {
            parts.push(`> ${diag.content.trim()}\n`);
         }
         if (diag.explanation) {
            parts.push(`*${diag.explanation.trim()}*\n`);
         }
      }
      visualMarkdown = parts.join('\n');
   }

   const title = typeof parsed.title === 'string' ? parsed.title : input.filename.replace(/\.[^/.]+$/, '');
   const description = typeof parsed.description === 'string' ? parsed.description : 'Document technique ingéré.';

   const metadata: OkfFrontmatterV2 = {
      type: typeof parsed.type === 'string' ? parsed.type : 'document',
      title,
      description,
      tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? (parsed.tags as string[]) : ['agronomie'],
      category: typeof parsed.category === 'string' ? parsed.category : (options.defaultCategory || 'inbox'),
      thematics: Array.isArray(parsed.thematics) ? (parsed.thematics as string[]) : undefined,
      soils: Array.isArray(parsed.soils) ? (parsed.soils as string[]) : undefined,
      climates: Array.isArray(parsed.climates) ? (parsed.climates as string[]) : undefined,
      itineraries: Array.isArray(parsed.itineraries) ? (parsed.itineraries as string[]) : undefined,
      crops: Array.isArray(parsed.crops) ? (parsed.crops as string[]) : undefined,
      authors: Array.isArray(parsed.authors) ? (parsed.authors as string[]) : undefined,
      publisher: typeof parsed.publisher === 'string' ? parsed.publisher : undefined,
      publicationYear: typeof parsed.publicationYear === 'string' ? parsed.publicationYear : undefined,
      language: typeof parsed.language === 'string' ? parsed.language : 'fr',
      originalLanguage: typeof parsed.originalLanguage === 'string' ? parsed.originalLanguage : (typeof parsed.language === 'string' ? parsed.language : 'fr'),
      abstracts: typeof parsed.abstracts === 'object' && parsed.abstracts !== null ? (parsed.abstracts as OkfMultilingualContent) : undefined,
      keywords: typeof parsed.keywords === 'object' && parsed.keywords !== null ? (parsed.keywords as OkfMultilingualKeywords) : undefined,
      status: 'draft',
      generated: {
         by: `quatrain/okf-ingest (${model})`,
         at: new Date().toISOString(),
         tokens: usage,
      },
   };

   // Final document body: Main text + transcribed visual diagrams
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
