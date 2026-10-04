import { describe, it, expect } from '@jest/globals';
import {
   buildOkfFrontmatter,
   serializeOkfDocument,
   parseOkfDocument,
} from '../serializer';
import { OkfFrontmatterV2 } from '../types';

describe('OKF v0.2 Serializer', () => {
   it('should generate valid OKF v0.2 frontmatter with standard comment header', () => {
      const metadata: OkfFrontmatterV2 = {
         type: 'document',
         title: 'Guide des couverts végétaux',
         description: 'Guide pratique pour implanter et détruire les couverts végétaux.',
         tags: ['couverts', 'agronomie'],
         status: 'draft',
         generated: {
            by: 'quatrain/okf-ingest (gemini-2.5-flash)',
            at: '2026-10-03T22:45:00.000Z',
            tokens: {
               prompt: 1500,
               candidates: 320,
               thinking: 100,
               total: 1920,
               costUsd: 0.000239,
            },
         },
         sources: [
            {
               id: 'original-pdf',
               resource: 'originals/agriculture/abc12345-guide.pdf',
               title: 'guide.pdf',
               fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            },
         ],
         soa: 'bradtech/world-agronomy',
         category: 'cover-crops',
      };

      const frontmatter = buildOkfFrontmatter(metadata);

      expect(frontmatter).toContain('# --- Open Knowledge Format v0.2 ---');
      expect(frontmatter).toContain('type: document');
      expect(frontmatter).toContain('title: Guide des couverts végétaux');
      expect(frontmatter).toContain('status: draft');
      expect(frontmatter).toContain('by: quatrain/okf-ingest (gemini-2.5-flash)');
      expect(frontmatter).toContain('costUsd: 0.000239');
      expect(frontmatter).toContain('soa: bradtech/world-agronomy');
   });

   it('should omit null, undefined, empty strings and empty arrays', () => {
      const metadata: OkfFrontmatterV2 = {
         type: 'document',
         title: 'Test Clean',
         description: 'Clean description.',
         tags: ['test'],
         publisher: '',
         authors: [],
         climates: undefined,
         isbn: undefined,
      };

      const frontmatter = buildOkfFrontmatter(metadata);

      expect(frontmatter).not.toContain('publisher');
      expect(frontmatter).not.toContain('authors');
      expect(frontmatter).not.toContain('climates');
      expect(frontmatter).not.toContain('isbn');
   });

   it('should serialize and parse back an OKF document faithfully', () => {
      const metadata: OkfFrontmatterV2 = {
         type: 'guide',
         title: 'Pédologie des sols vivants',
         description: 'Manuel de terrain pour analyser la structure grumeleuse du sol.',
         tags: ['pedologie', 'sol-vivant'],
         status: 'curated',
      };

      const body = '# Pédologie\n\nLe sol vivant héberge des millions de micro-organismes.\n\n```mermaid\ngraph TD\nA[Matière organique] --> B[Humus]\n```';
      const serialized = serializeOkfDocument(metadata, body);

      const parsed = parseOkfDocument(serialized);

      expect(parsed.metadata.title).toBe('Pédologie des sols vivants');
      expect(parsed.metadata.description).toBe('Manuel de terrain pour analyser la structure grumeleuse du sol.');
      expect(parsed.metadata.tags).toEqual(['pedologie', 'sol-vivant']);
      expect(parsed.body).toBe(body);
   });

   it('should serialize and parse multilingual metadata (language, abstracts, keywords)', () => {
      const metadata: OkfFrontmatterV2 = {
         type: 'document',
         title: 'Couverts végétaux et fertilité',
         description: 'Rôle des couverts dans la dynamique biologique.',
         tags: ['couverts', 'fertilite'],
         language: 'fr',
         originalLanguage: 'fr',
         abstracts: {
            en: 'Practical technical guide detailing cover crop sowing rates and biomass production.',
            ar: 'دليل تقني عملي يفصل معدلات بذر محاصيل التغطية وإنتاج الكتلة الحيوية.',
         },
         keywords: {
            en: ['cover-crops', 'biomass', 'soil-health'],
            ar: ['محاصيل-التغطية', 'الكتلة-الحيوية', 'صحة-التربة'],
         },
      };

      const serialized = serializeOkfDocument(metadata, '# Contenu');
      const parsed = parseOkfDocument(serialized);

      expect(parsed.metadata.language).toBe('fr');
      expect(parsed.metadata.originalLanguage).toBe('fr');
      expect(parsed.metadata.abstracts?.en).toContain('Practical technical guide');
      expect(parsed.metadata.abstracts?.ar).toContain('دليل تقني عملي');
      expect(parsed.metadata.keywords?.en).toEqual(['cover-crops', 'biomass', 'soil-health']);
      expect(parsed.metadata.keywords?.ar).toEqual(['محاصيل-التغطية', 'الكتلة-الحيوية', 'صحة-التربة']);
   });
});
