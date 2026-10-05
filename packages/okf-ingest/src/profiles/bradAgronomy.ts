import { Schema, Type } from '@google/genai';
import { DomainTaxonomyProfile } from '../types';

/**
 * Specialized agronomic taxonomy profile for BRAD agroecological knowledge bases (world-agronomy).
 * Captures orthogonal axes: soils, climates, technical itineraries, and targeted crops.
 */
export class BradAgronomyProfile implements DomainTaxonomyProfile {
   id = 'brad-agronomy';
   name = 'BRAD Agronomy & Agroecology Profile';
   systemRole =
      'You are an expert agronomist, soil scientist, and knowledge engineer specializing in agroecology and soil diagnostics for the Open Knowledge Format (OKF v0.2).';

   defaultCategory = 'soil-health';
   defaultTags = ['agronomie', 'agriculture'];

   promptGuidelines = [
      '8. Agronomic and Pedological Taxonomies (where relevant):',
      '   - "soils": Specific soil types or physical/biological soil states (e.g. argilo-calcaire, limoneux, sableux, acide, vivant-microbiote, compacte, hydromorphe).',
      '   - "climates": Climate zones concerned (e.g. mediterraneen, oceanique, semi-aride, continental).',
      '   - "itineraries": Agricultural management practices (e.g. viticulture-biologique, semis-direct, enherbement-permanent, faca-roulage).',
      '   - "crops": Targeted agricultural crops or plant varieties (e.g. vigne, ble, colza, maraichage, grandes-cultures).',
      '   - "thematics": Main thematic domains (e.g. soil-health, cover-crops, bio-indication, fertilization, water-management).',
   ];

   schemaProperties: Record<string, Schema> = {
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
