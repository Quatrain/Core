import { GoogleGenAI, Schema, Type } from '@google/genai';
import { calculateTokenCost, OkfTokenUsage } from '@quatrain/okf-ingest';
import {
   CatalogEntryChunk,
   CatalogParentBookRef,
   OkfCatalogEntryMetadata,
} from './types';

/**
 * Strict JSON Schema for Gemini structured catalog entry extraction.
 */
export const CATALOG_ENTRY_AI_SCHEMA: Schema = {
   type: Type.OBJECT,
   properties: {
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
      diagnosticKeys: {
         type: Type.ARRAY,
         items: { type: Type.STRING },
      },
      properties: {
         type: Type.ARRAY,
         items: { type: Type.STRING },
      },
      diagrams: {
         type: Type.ARRAY,
         items: {
            type: Type.OBJECT,
            properties: {
               title: { type: Type.STRING },
               type: { type: Type.STRING }, // mermaid | table | caption
               content: { type: Type.STRING },
               explanation: { type: Type.STRING },
            },
            required: ['title', 'type', 'content', 'explanation'],
         },
      },
   },
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

export interface EntryExtractionOptions {
   apiKey: string;
   parentBook: CatalogParentBookRef;
   entryType?: string;
   model?: string;
   defaultCategory?: string;
   soa?: string;
   revision?: string;
}

/**
 * Extracts and enriches a single encyclopedic/catalog entry.
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
   const ai = new GoogleGenAI({ apiKey: options.apiKey });
   const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

   const prompt = `Tu es un ingénieur agronome et taxonomiste expert pour l'Open Knowledge Format (OKF v0.2).
Analyse l'entrée encyclopédique suivante extraite de l'ouvrage "${options.parentBook.title}" (Entrée n° ${chunk.sequence}, pages ${chunk.pageRange || 'N/A'}) :

Titre détecté : ${chunk.rawTitle}
Nom scientifique probable : ${chunk.scientificName || 'à déterminer'}
Famille probable : ${chunk.family || 'à déterminer'}

Consignes strictes :
1. "title" : Nom vernaculaire principal suivi du binôme latin entre parenthèses (ex: "Chardon des champs (Cirsium arvense)").
2. "scientificName" : Nom binominal latin exact (genre et espèce en italique selon nomenclature internationale).
3. "family" : Famille botanique, zoologique ou chimique (ex: Asteraceae, Fabaceae, Lamiaceae).
4. "description" : Exactement UNE phrase concise décrivant la plante, son rôle bio-indicateur et ses caractéristiques maîtresses.
5. "language" & "originalLanguage" : Code ISO 639-1 (généralement "fr").
6. "abstracts" : Synthèse dense (2 à 3 phrases) décrivant les critères de diagnostic du sol et les propriétés :
   - "fr" : Synthèse technique en français.
   - "en" : Technical summary in English.
   - "ar" : ملخص تقني باللغة العربية الفصحى.
7. "keywords" : Mots-clés normalisés pour l'indexation (4 à 8 par langue) en "fr", "en", et "ar".
8. "soils" : Conditions de sol indiquées (ex: sol compacté, hydromorphisme, blocage phosphore, excès azote, sol calcaire, alcalin).
9. "diagnosticKeys" : Causes exactes de levée de dormance ou critères bio-indicateurs (ex: compaction superficielle, anaérobiose, blocage de la potasse).
10. "properties" : Propriétés d'usage (ex: alimentaire, médicinale, mellifère, toxique, adventice envahissante).
11. "diagrams" : Transcris tous les tableaux ou schémas présents sous forme de tableaux Markdown ou diagrammes Mermaid.

Texte brut de l'entrée :
---
${chunk.text}
---`;

   const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
         responseMimeType: 'application/json',
         responseSchema: CATALOG_ENTRY_AI_SCHEMA,
      },
   });

   if (!response.text) {
      throw new Error(`[OKF Catalog] No text returned from Gemini for entry "${chunk.rawTitle}"`);
   }

   const parsed = JSON.parse(response.text) as Record<string, unknown>;
   const usage: OkfTokenUsage = calculateTokenCost(response.usageMetadata, model);

   const title = typeof parsed.title === 'string' ? parsed.title : chunk.rawTitle;
   const scientificName = typeof parsed.scientificName === 'string' ? parsed.scientificName : chunk.scientificName;
   const family = typeof parsed.family === 'string' ? parsed.family : chunk.family;
   const description = typeof parsed.description === 'string' ? parsed.description : `Fiche bio-indicatrice pour ${title}.`;
   const category = typeof parsed.category === 'string' ? parsed.category : (options.defaultCategory || 'bio-indication');
   const language = typeof parsed.language === 'string' ? parsed.language : 'fr';
   const originalLanguage = typeof parsed.originalLanguage === 'string' ? parsed.originalLanguage : 'fr';

   const abstracts = (typeof parsed.abstracts === 'object' && parsed.abstracts !== null
      ? parsed.abstracts
      : { fr: description, en: description, ar: description }) as OkfCatalogEntryMetadata['abstracts'];

   const keywords = (typeof parsed.keywords === 'object' && parsed.keywords !== null
      ? parsed.keywords
      : { fr: [title], en: [title], ar: [title] }) as OkfCatalogEntryMetadata['keywords'];

   const tags = Array.isArray(parsed.tags) ? (parsed.tags as string[]) : [];
   const soils = Array.isArray(parsed.soils) ? (parsed.soils as string[]) : undefined;
   const climates = Array.isArray(parsed.climates) ? (parsed.climates as string[]) : undefined;
   const itineraries = Array.isArray(parsed.itineraries) ? (parsed.itineraries as string[]) : undefined;
   const crops = Array.isArray(parsed.crops) ? (parsed.crops as string[]) : undefined;
   const diagnosticKeys = Array.isArray(parsed.diagnosticKeys) ? (parsed.diagnosticKeys as string[]) : undefined;
   const properties = Array.isArray(parsed.properties) ? (parsed.properties as string[]) : undefined;

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
            const diagContent = String(diag.content || '');
            const diagExplanation = String(diag.explanation || '');

            if (diagType === 'mermaid' && diagContent.trim()) {
               diagramsCount++;
               diagramsList.push(`### ${diagTitle}\n\n\`\`\`mermaid\n${diagContent.trim()}\n\`\`\`\n\n*${diagExplanation}*\n`);
            } else if (diagType === 'table' && diagContent.trim()) {
               tablesCount++;
               diagramsList.push(`### ${diagTitle}\n\n${diagContent.trim()}\n\n*${diagExplanation}*\n`);
            }
         }
      }
   }

   const metadata: OkfCatalogEntryMetadata = {
      type: options.entryType || 'plant-profile',
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
      soa: options.soa || 'bradtech/world-agronomy',
      revision: options.revision,
      category,
      language,
      originalLanguage,
      abstracts,
      keywords,
      soils,
      climates,
      itineraries,
      crops,
      sequence: chunk.sequence,
      pageRange: chunk.pageRange,
      scientificName,
      family,
      diagnosticKeys,
      properties,
      parentBook: options.parentBook,
   };

   // Format rich, structured Markdown body
   let body = `# ${title}\n\n`;
   if (scientificName && family) {
      body += `**Nom scientifique :** *${scientificName}* | **Famille :** ${family}\n\n`;
   }
   if (chunk.pageRange) {
      body += `> Extrait de : [${options.parentBook.title}](../index.md) (pages ${chunk.pageRange})\n\n`;
   }

   if (diagnosticKeys && diagnosticKeys.length > 0) {
      body += `## 🔬 Critères de Bio-indication & Diagnostic du Sol\n\n`;
      for (const key of diagnosticKeys) {
         body += `- **${key}**\n`;
      }
      body += `\n`;
   }

   if (soils && soils.length > 0) {
      body += `## 🌱 Sols & Milieux Caractéristiques\n\n`;
      for (const s of soils) {
         body += `- ${s}\n`;
      }
      body += `\n`;
   }

   if (properties && properties.length > 0) {
      body += `## 🌿 Propriétés & Usages\n\n`;
      for (const p of properties) {
         body += `- ${p}\n`;
      }
      body += `\n`;
   }

   if (diagramsList.length > 0) {
      body += `## 📊 Données de Diagnostic & Schémas\n\n${diagramsList.join('\n')}\n`;
   }

   body += `## 📖 Description & Données Détaillées de l'Ouvrage\n\n${chunk.text.trim()}\n`;

   return {
      metadata,
      body,
      usage,
      diagramsTranscribed: diagramsCount,
      tablesTranscribed: tablesCount,
   };
}
