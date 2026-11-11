import { DomainTaxonomyProfile } from '../types';

/**
 * Clean, domain-agnostic taxonomy profile for general technical, scientific,
 * or encyclopedic documentation according to the OKF v0.2 specification.
 */
export class GenericDomainProfile implements DomainTaxonomyProfile {
   id = 'generic';
   name = 'Generic OKF Knowledge Profile';
   systemRole =
      'You are an expert knowledge engineer specializing in structured knowledge synthesis according to the Open Knowledge Format (OKF v0.2) specification.';

   defaultCategory = 'general';
   defaultTags = ['knowledge', 'okf'];
   targetLanguages = ['en'];

   promptGuidelines = [
      '8. "tags": Relevant lowercase tags identifying the primary topics and technical domains.',
   ];

   schemaProperties = {};

   extractDomainMetadata(rawResult: Record<string, unknown>): Record<string, unknown> {
      return {};
   }

   renderMarkdownSections(metadata: Record<string, unknown>): string {
      return '';
   }
}
