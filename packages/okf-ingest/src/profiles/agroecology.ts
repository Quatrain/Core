import { DomainTaxonomyProfile, OkfJsonSchemaProperty } from '../types';

/**
 * Specialized agronomic and agroecological taxonomy profile for OKF knowledge bases.
 * Captures orthogonal axes: soils, climates, technical itineraries, and targeted crops.
 */
export class AgroecologyTaxonomyProfile implements DomainTaxonomyProfile {
   id = 'agroecology';
   name = 'Agroecology & Agronomy Taxonomy Profile';
   systemRole =
      'You are an expert agronomist, soil scientist, and knowledge engineer specializing in agroecology and soil diagnostics for the Open Knowledge Format (OKF v0.2).';

   defaultCategory = 'soil-health';
   defaultTags = ['agronomie', 'agriculture'];
   targetLanguages = ['fr', 'en', 'ar'];

   promptGuidelines = [
      '8. Agronomic and Pedological Taxonomies (where relevant):',
      '   - "soils": Specific soil types or physical/biological soil states (e.g. argilo-calcaire, limoneux, sableux, acide, vivant-microbiote, compacte, hydromorphe).',
      '   - "climates": Climate zones concerned (e.g. mediterraneen, oceanique, semi-aride, continental).',
      '   - "itineraries": Agricultural management practices (e.g. viticulture-biologique, semis-direct, enherbement-permanent, faca-roulage).',
      '   - "crops": Targeted agricultural crops or plant varieties (e.g. vigne, ble, colza, maraichage, grandes-cultures).',
      '   - "thematics": Main thematic domains (e.g. soil-health, cover-crops, bio-indication, fertilization, water-management).',
   ];

   schemaProperties: Record<string, OkfJsonSchemaProperty> = {
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
   };

   extractDomainMetadata(rawResult: Record<string, unknown>): Record<string, unknown> {
      return {
         thematics: Array.isArray(rawResult.thematics) ? (rawResult.thematics as string[]) : undefined,
         soils: Array.isArray(rawResult.soils) ? (rawResult.soils as string[]) : undefined,
         climates: Array.isArray(rawResult.climates) ? (rawResult.climates as string[]) : undefined,
         itineraries: Array.isArray(rawResult.itineraries) ? (rawResult.itineraries as string[]) : undefined,
         crops: Array.isArray(rawResult.crops) ? (rawResult.crops as string[]) : undefined,
      };
   }
}

/**
 * @deprecated Use {@link AgroecologyTaxonomyProfile} instead. Kept for backwards compatibility.
 */
export { AgroecologyTaxonomyProfile as BradAgronomyProfile };
