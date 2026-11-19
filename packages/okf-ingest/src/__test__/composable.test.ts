import { describe, expect, it } from '@jest/globals';
import { AbstractAiAdapter } from '@quatrain/ai';
import { extractSemanticContent } from '../ai';
import { FacetTaxonomyProfile } from '../profiles/facets';
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

   it('asks the model for the facets an application declares', () => {
      const profile = new FacetTaxonomyProfile({
         id: 'catalogue',
         systemRole: 'You are an expert cataloguer.',
         thematics: ['guides', 'reference'],
         facets: [
            { name: 'region', description: 'Regions the document covers', examples: ['north', 'south'] },
            { name: 'audience', description: 'Who the document is for', values: ['beginner', 'expert'] },
         ],
      });
      expect(profile.id).toBe('catalogue');

      const prompt = buildDocumentPrompt({ filename: 'handbook.pdf', rawText: 'Sample' }, profile);

      expect(prompt).toContain('You are an expert cataloguer.');
      expect(prompt).toContain('"thematics": Themes of the knowledge base the document belongs to, among: guides, reference.');
      expect(prompt).toContain('"region": Regions the document covers. (e.g. north, south)');
      expect(prompt).toContain('"audience": Who the document is for. Choose among: beginner, expert.');
      expect(Object.keys(profile.schemaProperties)).toEqual(['thematics', 'region', 'audience']);
   });

   it('refuses a facet name that is not an identifier or is declared twice', () => {
      expect(() => new FacetTaxonomyProfile({ facets: [{ name: 'a b', description: 'x' }] })).toThrow();
      expect(() => new FacetTaxonomyProfile({ facets: [{ name: 'a', description: 'x' }, { name: 'a', description: 'y' }] })).toThrow();
      expect(() => new FacetTaxonomyProfile({ facets: [{ name: 'thematics', description: 'x' }] })).toThrow();
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
      expect(result.metadata.region).toBeUndefined();
      expect(result.usage.total).toBe(150);
   });

   it('should support parameterized target languages (e.g. en and es)', async () => {
      const mockAdapter = new MockAiAdapter({
         title: 'Maintenance Manual',
         type: 'guide',
         description: 'Equipment maintenance guide.',
         category: 'maintenance',
         tags: ['maintenance'],
         language: 'es',
         originalLanguage: 'es',
         abstracts: {
            en: 'English summary of equipment maintenance.',
            es: 'Resumen en español del mantenimiento.',
         },
         keywords: {
            en: ['maintenance', 'equipment'],
            es: ['mantenimiento', 'equipo'],
         },
      });

      const result = await extractSemanticContent(
         { rawText: 'Maintenance text in Spanish', filename: 'manual.pdf' },
         undefined,
         {
            adapter: mockAdapter,
            taxonomyProfile: new GenericDomainProfile(),
            targetLanguages: ['en', 'es'],
         }
      );

      expect(mockAdapter.lastPrompt).toContain('clear scientific English');
      expect(mockAdapter.lastPrompt).toContain('formal Spanish');
      expect(result.metadata.abstracts?.en).toBe('English summary of equipment maintenance.');
      expect(result.metadata.abstracts?.es).toBe('Resumen en español del mantenimiento.');
      expect(result.metadata.keywords?.es).toEqual(['mantenimiento', 'equipo']);
   });

   it('keeps the declared facets of the answer, and only the values of a closed vocabulary', async () => {
      const mockAdapter = new MockAiAdapter({
         title: 'Gestion des ateliers',
         type: 'guide',
         description: 'Guide technique.',
         category: 'guides',
         tags: ['atelier'],
         language: 'fr',
         originalLanguage: 'fr',
         abstracts: { fr: 'Synthèse.', en: 'Summary.', ar: 'ملخص.' },
         keywords: { fr: ['atelier'], en: ['workshop'], ar: ['ورشة'] },
         thematics: ['guides', 'unknown-theme'],
         region: ['north', 'north', ''],
         audience: ['expert', 'everyone'],
         undeclared: ['dropped'],
      });
      const profile = new FacetTaxonomyProfile({
         thematics: ['guides', 'reference'],
         targetLanguages: ['fr', 'en', 'ar'],
         facets: [
            { name: 'region', description: 'Regions' },
            { name: 'audience', description: 'Audience', values: ['beginner', 'expert'] },
         ],
      });

      const result = await extractSemanticContent(
         { rawText: 'Texte technique', filename: 'atelier.pdf' },
         undefined,
         { adapter: mockAdapter, taxonomyProfile: profile }
      );

      expect(result.metadata.title).toBe('Gestion des ateliers');
      expect(result.metadata.thematics).toEqual(['guides']);
      expect(result.metadata.region).toEqual(['north']);
      expect(result.metadata.audience).toEqual(['expert']);
      expect(result.metadata.undeclared).toBeUndefined();
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
