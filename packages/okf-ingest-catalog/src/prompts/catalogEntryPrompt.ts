import { DomainTaxonomyProfile, LANGUAGE_SYNTHESIS_DESCRIPTIONS } from '@quatrain/okf-ingest';
import { CatalogEntryChunk, CatalogParentBookRef } from '../types';

export interface CatalogEntryPromptParams {
   chunk: CatalogEntryChunk;
   parentBook: CatalogParentBookRef;
   languages?: string[];
}

/**
 * Builds an International English prompt for structured encyclopedic or catalog entry extraction,
 * composable with domain taxonomy profiles and configurable target languages.
 */
export function buildCatalogEntryPrompt(
   params: CatalogEntryPromptParams,
   profile?: DomainTaxonomyProfile
): string {
   const { chunk, parentBook } = params;

   const systemRole =
      profile?.systemRole ||
      'You are an expert taxonomist and knowledge engineer specializing in encyclopedic knowledge synthesis and catalog entries according to the Open Knowledge Format (OKF v0.2) specification.';

   const targetLanguages = params.languages || profile?.targetLanguages || ['en'];

   const abstractLines = targetLanguages.map(
      (lang) =>
         `   - "${lang}": ${LANGUAGE_SYNTHESIS_DESCRIPTIONS[lang] || `Technical synthesis in language "${lang}".`}`
   );

   const guidelines: string[] = [
      '1. "title": Clean primary common or vernacular entry name, optionally followed by Latin binomial or notation in parentheses (e.g. "Spearmint (Mentha spicata)").',
      '2. "scientificName": Canonical Latin binomial, universal taxonomic designation, or official scientific nomenclature.',
      '3. "family": Taxonomic family, botanical/zoological group, or chemical/functional family classification.',
      '4. "description": Exactly ONE concise sentence describing the subject, its primary classification, and distinguishing functional characteristics.',
      '5. "language" & "originalLanguage": ISO 639-1 two-letter language code (typically "en" or "fr").',
      `6. "abstracts": Dense, high-value technical synthesis (2 to 3 sentences) describing diagnostic traits and functional properties in the following languages (${targetLanguages.join(', ')}):`,
      ...abstractLines,
      `7. "keywords": Standardized indexing keywords (4 to 8 per language) for each configured language (${targetLanguages.join(', ')}).`,
      '8. "tags": Lowercase semantic tags capturing domain taxonomy and parent publication references.',
      '9. "properties": Functional properties, agricultural traits, pharmacological effects, or technical applications.',
   ];

   if (profile?.promptGuidelines && profile.promptGuidelines.length > 0) {
      guidelines.push(...profile.promptGuidelines);
   }

   guidelines.push(
      '10. "diagrams": Transcribe all charts, comparison matrices, or morphological tables into clean Markdown tables or Mermaid diagrams.'
   );

   return `${systemRole}

Analyze the following encyclopedic entry extracted from the publication "${parentBook.title}" (Entry #${chunk.sequence}, pages ${chunk.pageRange || 'N/A'}):

Detected Header: ${chunk.rawTitle}
Probable Scientific / Canonical Name: ${chunk.scientificName || 'To be determined'}
Probable Family / Classification: ${chunk.family || 'To be determined'}

Strict Instructions:
${guidelines.join('\n')}

Raw Entry Text:
---
${chunk.text}
---`;
}
