import { describe, expect, it } from '@jest/globals';
import { AbstractAiAdapter } from '@quatrain/ai';
import { extractSemanticContent } from '../ai';
import { AgroecologyTaxonomyProfile, BradAgronomyProfile } from '../profiles/agroecology';
import { GenericDomainProfile } from '../profiles/generic';
import { buildDocumentPrompt } from '../prompts/documentPrompt';
import { buildBookOutlinePrompt } from '../prompts/outlinePrompt';

class MockAiAdapter extends AbstractAiAdapter {
   public lastPrompt = '';

   constructor(private mockResponse: Record<string, unknown>) {
      super();
   }

   init(): void {}

   async generateText(_prompt: string, _options?: unknown): Promise<string> {
      return JSON.stringify(this.mockResponse);
   }

   async generateStructured(prompt: unknown, _schema: unknown, options?: unknown): Promise<unknown> {
      this.lastPrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
      if (options && typeof options === 'object' && 'onUsage' in options) {
         const onUsage = (options as { onUsage?: (u: unknown) => void }).onUsage;
         if (typeof onUsage === 'function') {
            onUsage({
               promptTokenCount: 100,
               candidatesTokenCount: 50,
               totalTokenCount: 150,
            });
         }
      }
      return this.mockResponse;
   }
}

describe('Composable Architecture & Decoupled AI Runners', () => {
   it('should generate International English document prompt with generic profile', () => {
      const prompt = buildDocumentPrompt(
         { filename: 'test-doc.pdf', rawText: 'Sample content for testing' },
         new GenericDomainProfile()
      );

      expect(prompt).toContain('You are an expert knowledge engineer specializing in structured knowledge synthesis');
      expect(prompt).toContain('1. "title": Professional, clean, and explicit title');
      expect(prompt).toContain('6. "abstracts": Dense, high-value technical synthesis');
      expect(prompt).not.toContain('Tu es un ingénieur expert');
   });

   it('should inject domain guidelines when using AgroecologyTaxonomyProfile', () => {
      const profile = new AgroecologyTaxonomyProfile();
      expect(profile.id).toBe('agroecology');
      expect(new BradAgronomyProfile()).toBeInstanceOf(AgroecologyTaxonomyProfile);

      const prompt = buildDocumentPrompt(
         { filename: 'agronomy-guide.pdf', rawText: 'Soil biology' },
         profile
      );

      expect(prompt).toContain('You are an expert agronomist, soil scientist');
      expect(prompt).toContain('"soils": Specific soil types');
      expect(prompt).toContain('"climates": Climate zones');
      expect(prompt).toContain('"itineraries": Agricultural management practices');
   });

   it('should extract generic document metadata using a decoupled custom AbstractAiAdapter without Gemini SDK', async () => {
      const mockAdapter = new MockAiAdapter({
         title: 'Decoupled Architecture Standard',
         type: 'specification',
         description: 'Standard for building decoupled and composable AI pipelines.',
         category: 'architecture',
         tags: ['architecture', 'decoupling'],
         language: 'en',
         originalLanguage: 'en',
         abstracts: {
            en: 'Dense English abstract on decoupled architecture.',
         },
         keywords: {
            en: ['architecture', 'decoupling'],
         },
      });

      const result = await extractSemanticContent(
         { rawText: 'Decoupled architecture documentation', filename: 'standard.md' },
         undefined,
         { adapter: mockAdapter, taxonomyProfile: new GenericDomainProfile() }
      );

      expect(mockAdapter.lastPrompt).toContain('Decoupled architecture documentation');
      expect(result.metadata.title).toBe('Decoupled Architecture Standard');
      expect(result.metadata.type).toBe('specification');
      expect(result.metadata.category).toBe('architecture');
      expect(result.metadata.abstracts?.en).toContain('Dense English abstract');
      expect(result.metadata.soils).toBeUndefined();
      expect(result.metadata.climates).toBeUndefined();
      expect(result.usage.total).toBe(150);
   });

   it('should support parameterized target languages (e.g. en and es)', async () => {
      const mockAdapter = new MockAiAdapter({
         title: 'Plant Health Manual',
         type: 'guide',
         description: 'Botanical guide.',
         category: 'botany',
         tags: ['plants'],
         language: 'es',
         originalLanguage: 'es',
         abstracts: {
            en: 'English summary of plant health.',
            es: 'Resumen en español de salud vegetal.',
         },
         keywords: {
            en: ['plants', 'health'],
            es: ['plantas', 'salud'],
         },
      });

      const result = await extractSemanticContent(
         { rawText: 'Plant biology text in Spanish', filename: 'manual.pdf' },
         undefined,
         {
            adapter: mockAdapter,
            taxonomyProfile: new GenericDomainProfile(),
            targetLanguages: ['en', 'es'],
         }
      );

      expect(mockAdapter.lastPrompt).toContain('clear scientific English');
      expect(mockAdapter.lastPrompt).toContain('formal Spanish');
      expect(result.metadata.abstracts?.en).toBe('English summary of plant health.');
      expect(result.metadata.abstracts?.es).toBe('Resumen en español de salud vegetal.');
      expect(result.metadata.keywords?.es).toEqual(['plantas', 'salud']);
   });

   it('should extract agronomic taxonomies when AgroecologyTaxonomyProfile is supplied', async () => {
      const mockAdapter = new MockAiAdapter({
         title: 'Gestion des sols calcaires',
         type: 'guide',
         description: 'Guide technique pour sols argilo-calcaires.',
         category: 'soil-health',
         tags: ['sol', 'calcaire'],
         language: 'fr',
         originalLanguage: 'fr',
         abstracts: {
            fr: 'Synthèse sur les sols argilo-calcaires.',
            en: 'Summary on clay-limestone soils.',
            ar: 'ملخص حول التربة الكلسية.',
         },
         keywords: {
            fr: ['sol', 'calcaire'],
            en: ['soil', 'limestone'],
            ar: ['تربة', 'كلسي'],
         },
         soils: ['argilo-calcaire'],
         climates: ['mediterraneen'],
         itineraries: ['semis-direct'],
         crops: ['vigne'],
      });

      const result = await extractSemanticContent(
         { rawText: 'Texte agronomique', filename: 'sols.pdf' },
         undefined,
         { adapter: mockAdapter, taxonomyProfile: new AgroecologyTaxonomyProfile() }
      );

      expect(result.metadata.title).toBe('Gestion des sols calcaires');
      expect(result.metadata.soils).toEqual(['argilo-calcaire']);
      expect(result.metadata.climates).toEqual(['mediterraneen']);
      expect(result.metadata.itineraries).toEqual(['semis-direct']);
      expect(result.metadata.crops).toEqual(['vigne']);
      expect(result.metadata.abstracts?.fr).toBeDefined();
      expect(result.metadata.abstracts?.en).toBeDefined();
      expect(result.metadata.abstracts?.ar).toBeDefined();
   });

   it('should generate International English book outline prompt', () => {
      const prompt = buildBookOutlinePrompt(
         { filename: 'encyclopedia.pdf', sampleText: 'Table of contents...' },
         new GenericDomainProfile()
      );

      expect(prompt).toContain('Analyze this large book or monograph');
      expect(prompt).toContain('1. "title": Official and complete book or monograph title');
      expect(prompt).toContain('"license": Standard SPDX license identifier');
      expect(prompt).toContain('"chapters": Ordered array of logical chapters');
      expect(prompt).not.toContain('Tu es un ingénieur expert');
   });
});
