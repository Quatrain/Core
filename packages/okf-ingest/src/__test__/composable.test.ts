import { describe, expect, it } from 'bun:test';
import { extractSemanticContent } from '../ai';
import { BradAgronomyProfile } from '../profiles/bradAgronomy';
import { GenericDomainProfile } from '../profiles/generic';
import { buildDocumentPrompt } from '../prompts/documentPrompt';
import { buildBookOutlinePrompt } from '../prompts/outlinePrompt';
import { AiRunnerOptions, AiRunnerResponse, AiStructuredRunner, OkfTokenUsage } from '../types';

class MockStructuredRunner implements AiStructuredRunner {
   public lastPrompt = '';

   constructor(private mockResponse: Record<string, unknown>) {}

   async generateStructured<T = Record<string, unknown>>(
      prompt: string,
      _schema: unknown,
      _options?: AiRunnerOptions
   ): Promise<AiRunnerResponse<T>> {
      this.lastPrompt = prompt;
      const usage: OkfTokenUsage = {
         prompt: 100,
         candidates: 50,
         thinking: 0,
         total: 150,
         costUsd: 0.00005,
      };

      return {
         data: this.mockResponse as T,
         usage,
         rawText: JSON.stringify(this.mockResponse),
      };
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

   it('should inject domain guidelines when using BradAgronomyProfile', () => {
      const prompt = buildDocumentPrompt(
         { filename: 'agronomy-guide.pdf', rawText: 'Soil biology' },
         new BradAgronomyProfile()
      );

      expect(prompt).toContain('You are an expert agronomist, soil scientist');
      expect(prompt).toContain('"soils": Specific soil types');
      expect(prompt).toContain('"climates": Climate zones');
      expect(prompt).toContain('"itineraries": Agricultural management practices');
   });

   it('should extract generic document metadata using a decoupled custom runner without Gemini SDK', async () => {
      const mockRunner = new MockStructuredRunner({
         title: 'Decoupled Architecture Standard',
         type: 'specification',
         description: 'Standard for building decoupled and composable AI pipelines.',
         category: 'architecture',
         tags: ['architecture', 'decoupling'],
         language: 'en',
         originalLanguage: 'en',
         abstracts: {
            en: 'Dense English abstract on decoupled architecture.',
            fr: 'Synthèse en français.',
            ar: 'ملخص باللغة العربية.',
         },
         keywords: {
            en: ['architecture', 'decoupling'],
            fr: ['architecture', 'découplage'],
            ar: ['معمارية', 'فصل'],
         },
      });

      const result = await extractSemanticContent(
         { rawText: 'Decoupled architecture documentation', filename: 'standard.md' },
         undefined,
         { runner: mockRunner, taxonomyProfile: new GenericDomainProfile() }
      );

      expect(mockRunner.lastPrompt).toContain('Decoupled architecture documentation');
      expect(result.metadata.title).toBe('Decoupled Architecture Standard');
      expect(result.metadata.type).toBe('specification');
      expect(result.metadata.category).toBe('architecture');
      expect(result.metadata.soils).toBeUndefined();
      expect(result.metadata.climates).toBeUndefined();
      expect(result.usage.total).toBe(150);
   });

   it('should extract agronomic taxonomies when BradAgronomyProfile is supplied', async () => {
      const mockRunner = new MockStructuredRunner({
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
         { runner: mockRunner, taxonomyProfile: new BradAgronomyProfile() }
      );

      expect(result.metadata.title).toBe('Gestion des sols calcaires');
      expect(result.metadata.soils).toEqual(['argilo-calcaire']);
      expect(result.metadata.climates).toEqual(['mediterraneen']);
      expect(result.metadata.itineraries).toEqual(['semis-direct']);
      expect(result.metadata.crops).toEqual(['vigne']);
   });

   it('should generate International English book outline prompt', () => {
      const prompt = buildBookOutlinePrompt(
         { filename: 'encyclopedia.pdf', sampleText: 'Table of contents...' },
         new GenericDomainProfile()
      );

      expect(prompt).toContain('Analyze this large book or monograph');
      expect(prompt).toContain('1. "title": Official and complete book or monograph title');
      expect(prompt).toContain('11. "chapters": Ordered array of logical chapters');
      expect(prompt).not.toContain('Tu es un ingénieur expert');
   });
});
