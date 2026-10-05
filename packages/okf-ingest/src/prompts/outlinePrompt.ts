import { DomainTaxonomyProfile } from '../types';

export interface BookOutlinePromptParams {
   filename: string;
   sampleText: string;
}

/**
 * Builds an International English prompt for monograph/book outline extraction,
 * composable with optional domain taxonomy profiles.
 */
export function buildBookOutlinePrompt(
   params: BookOutlinePromptParams,
   profile?: DomainTaxonomyProfile
): string {
   const systemRole =
      profile?.systemRole ||
      'You are an expert knowledge engineer specializing in structured knowledge synthesis and comprehensive book decomposition according to the Open Knowledge Format (OKF v0.2) specification.';

   const guidelines: string[] = [
      '1. "title": Official and complete book or monograph title (without file extensions).',
      '2. "description": Exactly ONE concise sentence summarizing the scope and subject matter of the book in its original language.',
      '3. "category": Lowercase slugified category folder path (e.g. soil-health, methodology, reference, agronomy-books).',
      '4. "language": ISO 639-1 code of the primary book language (e.g. "en", "fr", "es", "de", "ar").',
      '5. "originalLanguage": ISO 639-1 code of original publication.',
      '6. "abstracts": Global dense technical abstract (2 to 3 sentences) in 3 languages:',
      '   - "en": Scientific abstract in high-density English.',
      '   - "fr": Technical abstract in formal French.',
      '   - "ar": Technical abstract in formal Modern Standard Arabic (الفصحى).',
      '7. "keywords": Standardized index keywords (4 to 8 per language) in "en", "fr", and "ar".',
      '8. "authors": Array of contributing author names discovered in the book.',
      '9. "publisher": Publishing house or institution if identifiable.',
      '10. "publicationYear": Year of publication if identifiable.',
   ];

   if (profile?.promptGuidelines && profile.promptGuidelines.length > 0) {
      guidelines.push(...profile.promptGuidelines);
   }

   guidelines.push(
      '11. "chapters": Ordered array of logical chapters or major structural parts (typically 3 to 12 chapters):',
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
