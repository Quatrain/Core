import { DomainTaxonomyProfile } from '../types';

export interface DocumentPromptParams {
   filename: string;
   rawText?: string;
   isScanned?: boolean;
   contextNote?: string;
   maxExcerptChars?: number;
   languages?: string[];
}

export const LANGUAGE_SYNTHESIS_DESCRIPTIONS: Record<string, string> = {
   en: 'High-density technical summary in clear scientific English.',
   fr: 'High-density technical summary in formal French.',
   ar: 'High-density technical summary in formal Modern Standard Arabic (الفصحى).',
   es: 'High-density technical summary in formal Spanish.',
   de: 'High-density technical summary in formal German.',
   it: 'High-density technical summary in formal Italian.',
   pt: 'High-density technical summary in formal Portuguese.',
   ja: 'High-density technical summary in formal Japanese.',
   zh: 'High-density technical summary in formal Chinese.',
};

/**
 * Builds an International English prompt for semantic document extraction,
 * composable with optional domain taxonomy profiles and configurable target languages.
 */
export function buildDocumentPrompt(
   params: DocumentPromptParams,
   profile?: DomainTaxonomyProfile
): string {
   const systemRole =
      profile?.systemRole ||
      'You are an expert knowledge engineer specializing in structured knowledge synthesis according to the Open Knowledge Format (OKF v0.2) specification.';

   const targetLanguages = params.languages || profile?.targetLanguages || ['en'];

   const abstractLines = targetLanguages.map(
      (lang) =>
         `   - "${lang}": ${(Reflect.get(LANGUAGE_SYNTHESIS_DESCRIPTIONS, lang) as string | undefined) || `High-density technical summary in language "${lang}".`}`
   );

   const guidelines: string[] = [
      '1. "title": Professional, clean, and explicit title (without file extensions).',
      '2. "description": Exactly ONE concise sentence summarizing the scope, technical relevance, and utility of the document in its primary language.',
      '3. "category": Short lowercase slugified category path (e.g. general, documentation, reference, methodology).',
      '4. "language": Mandatory ISO 639-1 two-letter code for the primary text language (e.g. "en", "fr", "es", "de", "ar").',
      '5. "originalLanguage": ISO 639-1 code of the original text (matches "language" unless translated).',
      `6. "abstracts": Dense, high-value technical synthesis (2 to 3 sentences) in the following languages (${targetLanguages.join(', ')}):`,
      ...abstractLines,
      `7. "keywords": Standardized indexing keywords (4 to 8 per language) for each configured language (${targetLanguages.join(', ')}).`,
      '8. "tags": Lowercase semantic tags capturing the main technical concepts.',
      '9. "license": Standard SPDX license identifier or Open Access status if stated (e.g. "CC-BY-4.0", "CC-BY-SA-4.0", "CC0-1.0", "Open Access", "Proprietary", "All Rights Reserved", or omitted if unknown).',
      '10. "copyright": Legal copyright notice if explicitly present (e.g. "© 2024 Éditions France Agricole, Paris").',
   ];

   // Add domain-specific prompt guidelines if provided
   if (profile?.promptGuidelines && profile.promptGuidelines.length > 0) {
      guidelines.push(...profile.promptGuidelines);
   }

   guidelines.push(
      '11. "diagrams": CRITICAL — For every technical workflow, system cycle, data flow, or comparative data table discovered in the content:',
      '   - If it represents a workflow, sequence, architecture, or cycle: provide complete, valid Mermaid code ("type": "mermaid", "content": "graph TD\\n...").',
      '   - If it represents tabular comparative data: provide the full Markdown table ("type": "table", "content": "| Col1 | Col2 |\\n|---|---|...").',
      '   - If it is a complex visual diagram: provide an exhaustive, dense technical caption ("type": "caption").'
   );

   let prompt = `${systemRole}\n\n`;
   prompt += `Analyze the attached document (${params.filename}) and extract its metadata, taxonomies, multilingual summaries, and visual diagram representations.\n\n`;
   prompt += `Strict Instructions:\n${guidelines.join('\n')}\n`;

   if (params.contextNote) {
      prompt += `\nPriority Contextual Note:\n${params.contextNote}\n`;
   }

   if (params.rawText) {
      const maxChars = params.maxExcerptChars || 80_000;
      let excerpt = params.rawText;
      if (excerpt.length > maxChars) {
         const headLen = Math.floor(maxChars * 0.7);
         const tailLen = Math.floor(maxChars * 0.3);
         excerpt = `${excerpt.substring(0, headLen)}\n\n[... intermediate voluminous text omitted for analysis ...]\n\n${excerpt.substring(excerpt.length - tailLen)}`;
      }
      prompt += `\nText excerpt of the document:\n---\n${excerpt}\n---`;
   }

   return prompt;
}
