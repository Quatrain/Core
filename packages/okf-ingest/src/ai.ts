import { GoogleGenAI } from '@google/genai';
import { calculateTokenCost } from './cost';
import {
   ExtractionOptions,
   IngestionExtractionResult,
   OkfFrontmatterV2,
   OkfTokenUsage,
} from './types';

export const OKF_INGEST_AI_SCHEMA = {
   type: 'OBJECT',
   properties: {
      title: { type: 'STRING' },
      type: { type: 'STRING' },
      description: { type: 'STRING' },
      category: { type: 'STRING' },
      thematics: {
         type: 'ARRAY',
         items: { type: 'STRING' },
      },
      soils: {
         type: 'ARRAY',
         items: { type: 'STRING' },
      },
      climates: {
         type: 'ARRAY',
         items: { type: 'STRING' },
      },
      itineraries: {
         type: 'ARRAY',
         items: { type: 'STRING' },
      },
      crops: {
         type: 'ARRAY',
         items: { type: 'STRING' },
      },
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
      diagrams: {
         type: 'ARRAY',
         items: {
            type: 'OBJECT',
            properties: {
               title: { type: 'STRING' },
               type: { type: 'STRING' }, // mermaid | table | caption
               content: { type: 'STRING' }, // Mermaid diagram code or Markdown table
               explanation: { type: 'STRING' },
            },
            required: ['title', 'type', 'content', 'explanation'],
         },
      },
   },
   required: ['title', 'description', 'category', 'tags'],
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
Analyse le document ci-joint (${input.filename}) et extrais ses métadonnées, taxonomies et représentations visuelles.

Consignes strictes :
1. "title" : Titre propre, professionnel et explicite (sans extension).
2. "description" : Exactement UNE seule phrase concise résumant le document, sa portée et son utilité technique.
3. "category" : Chemin de dossier court en minuscules slugifiées (ex: soil-health, cover-crops, viticulture, agriculture, water-management, soil-amendments, formations).
4. Taxonomies agronomiques (selon pertinence) :
   - "soils" : sols concernés (ex: argilo-calcaire, limoneux, sableux, vivant-microbiote).
   - "climates" : zones climatiques (ex: mediterraneen, oceanique, semi-aride, continental).
   - "itineraries" : pratiques (ex: viticulture-biologique, semis-direct, enherbement-permanent).
   - "crops" : cultures ciblées (ex: vigne, ble, colza, maraichage).
5. "diagrams" : CRITIQUE — Pour chaque schéma, organigramme, flux de travail, cycle technique ou tableau clé repéré :
   - Si c'est un flux, processus ou cycle : fournis le code Mermaid complet ("type": "mermaid", "content": "graph TD\\n...").
   - Si c'est un tableau de comparaison ou de données : fournis le tableau Markdown complet ("type": "table", "content": "| Col1 | Col2 |\\n|---|---|...").
   - Si c'est une figure visuelle complexe : fournis une description technique dense et exhaustive ("type": "caption").

${options.contextNote ? `Note contextuelle prioritaire :\n${options.contextNote}\n` : ''}`;

   let contents: unknown;

   if (input.isScanned && input.buffer && input.isPdf) {
      // Multimodal direct PDF upload for scanned / image-dense documents
      const base64Data = input.buffer.toString('base64');
      contents = [
         { text: promptText },
         {
            inlineData: {
               mimeType: 'application/pdf',
               data: base64Data,
            },
         },
      ];
   } else {
      const excerpt = (input.rawText || '').substring(0, 12000);
      contents = `${promptText}\n\nExtrait du contenu texte du document :\n---\n${excerpt}\n---`;
   }

   const response = await ai.models.generateContent({
      model,
      contents: contents as any,
      config: {
         responseMimeType: 'application/json',
         responseSchema: OKF_INGEST_AI_SCHEMA as any,
      },
   });

   if (!response.text) {
      throw new Error('[OKF Ingest] No response text returned from Gemini API');
   }

   const parsed = JSON.parse(response.text) as Record<string, any>;
   const usage: OkfTokenUsage = calculateTokenCost(response.usageMetadata, model);

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

   const title = parsed.title || input.filename.replace(/\.[^/.]+$/, '');
   const description = parsed.description || 'Document technique ingéré.';

   const metadata: OkfFrontmatterV2 = {
      type: parsed.type || 'document',
      title,
      description,
      tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : ['agronomie'],
      category: parsed.category || options.defaultCategory || 'inbox',
      thematics: parsed.thematics,
      soils: parsed.soils,
      climates: parsed.climates,
      itineraries: parsed.itineraries,
      crops: parsed.crops,
      authors: parsed.authors,
      publisher: parsed.publisher,
      publicationYear: parsed.publicationYear,
      language: parsed.language || 'fr',
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
