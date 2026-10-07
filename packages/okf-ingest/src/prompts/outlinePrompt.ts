import { DomainTaxonomyProfile } from '../types';
import { LANGUAGE_SYNTHESIS_DESCRIPTIONS } from './documentPrompt';

export interface BookOutlinePromptParams {
   filename: string;
   sampleText: string;
   languages?: string[];
}

/**
 * Builds an International English prompt for monograph/book outline extraction,
 * composable with optional domain taxonomy profiles and configurable target languages.
 */
export function buildBookOutlinePrompt(
   params: BookOutlinePromptParams,
   profile?: DomainTaxonomyProfile
): string {
   const systemRole =
      profile?.systemRole ||
      'You are an expert knowledge engineer specializing in structured knowledge synthesis and comprehensive book decomposition according to the Open Knowledge Format (OKF v0.2) specification.';

   const targetLanguages = params.languages || profile?.targetLanguages || ['en'];

   const abstractLines = targetLanguages.map(
      (lang) =>
         `   - "${lang}": ${LANGUAGE_SYNTHESIS_DESCRIPTIONS[lang] || `Technical abstract in language "${lang}".`}`
   );

   const guidelines: string[] = [
      '1. "title": Official and complete book or monograph title (without file extensions).',
      '2. "description": Exactly ONE concise sentence summarizing the scope and subject matter of the book in its original language.',
      '3. "category": Lowercase slugified category folder path (e.g. soil-health, methodology, reference, agronomy-books).',
      '4. "language": ISO 639-1 code of the primary book language (e.g. "en", "fr", "es", "de", "ar").',
      '5. "originalLanguage": ISO 639-1 code of original publication.',
      `6. "abstracts": Global dense technical abstract (2 to 3 sentences) in the following languages (${targetLanguages.join(', ')}):`,
      ...abstractLines,
      `7. "keywords": Standardized index keywords (4 to 8 per language) for each configured language (${targetLanguages.join(', ')}).`,
      '8. "authors": Array of contributing author names discovered in the book.',
      '9. "publisher": Publishing house or institution if identifiable.',
      '10. "publicationYear": Year of publication if identifiable.',
      '11. "license": Standard SPDX license identifier or Open Access status if stated (e.g. "CC-BY-4.0", "CC-BY-SA-4.0", "CC0-1.0", "Open Access", "Proprietary", "All Rights Reserved", or omitted if unknown).',
      '12. "copyright": Formal legal copyright statement if present (e.g. "© 2024 Éditions France Agricole, Paris").',
   ];

   if (profile?.promptGuidelines && profile.promptGuidelines.length > 0) {
      guidelines.push(...profile.promptGuidelines);
   }

   guidelines.push(
      '13. "chapters": Ordered array of logical chapters or major structural parts (typically 3 to 12 chapters):',
      '    - "index": Sequence number of the chapter (1, 2, 3...).',
      '    - "title": Clean, explicit chapter title.',
      '    - "summary": Concise 1 to 2 sentence summary of chapter content.',
      '    - "startMarker": Exact textual phrase of 5 to 10 consecutive words appearing at the very beginning of this chapter in the excerpt below to serve as an anchor.',
      '    - "endMarker": Exact textual phrase of 5 to 10 consecutive words towards the end of this chapter.'
   );

   return `${systemRole}

Analyze this large book or monograph (${params.filename}) to identify its overall outline and decompose its content into logical, self-contained chapters.

Strict Instructions:
${guidelines.join('\n')}

Representative excerpt of the book:
---
${params.sampleText}
---`;
}
