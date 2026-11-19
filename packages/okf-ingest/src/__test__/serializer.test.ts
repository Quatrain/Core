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
         title: 'Guide de maintenance',
         description: 'Guide pratique pour entretenir les équipements.',
         tags: ['maintenance', 'equipements'],
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
               resource: 'originals/guides/abc12345-guide.pdf',
               title: 'guide.pdf',
               fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            },
         ],
         soa: 'quatrain/knowledge',
         category: 'maintenance',
      };

      const frontmatter = buildOkfFrontmatter(metadata);

      expect(frontmatter).toContain('# --- Open Knowledge Format v0.2 ---');
      expect(frontmatter).toContain('type: document');
      expect(frontmatter).toContain('title: Guide de maintenance');
      expect(frontmatter).toContain('status: draft');
      expect(frontmatter).toContain('by: quatrain/okf-ingest (gemini-2.5-flash)');
      expect(frontmatter).toContain('costUsd: 0.000239');
      expect(frontmatter).toContain('soa: quatrain/knowledge');
   });

   it('should omit null, undefined, empty strings and empty arrays', () => {
      const metadata: OkfFrontmatterV2 = {
         type: 'document',
         title: 'Test Clean',
         description: 'Clean description.',
         tags: ['test'],
         publisher: '',
         authors: [],
         region: undefined,
         isbn: undefined,
      };

      const frontmatter = buildOkfFrontmatter(metadata);

      expect(frontmatter).not.toContain('publisher');
      expect(frontmatter).not.toContain('authors');
      expect(frontmatter).not.toContain('region');
      expect(frontmatter).not.toContain('isbn');
   });

   it('should serialize and parse back an OKF document faithfully', () => {
      const metadata: OkfFrontmatterV2 = {
         type: 'guide',
         title: 'Architecture des systèmes distribués',
         description: 'Manuel pour analyser la structure des systèmes.',
         tags: ['methodes', 'fiabilite'],
         status: 'curated',
      };

      const body = '# Architecture\n\nUn système distribué coordonne des milliers de nœuds.\n\n```mermaid\ngraph TD\nA[Client] --> B[Serveur]\n```';
      const serialized = serializeOkfDocument(metadata, body);

      const parsed = parseOkfDocument(serialized);

      expect(parsed.metadata.title).toBe('Architecture des systèmes distribués');
      expect(parsed.metadata.description).toBe('Manuel pour analyser la structure des systèmes.');
      expect(parsed.metadata.tags).toEqual(['methodes', 'fiabilite']);
      expect(parsed.body).toBe(body);
   });

   it('should serialize and parse multilingual metadata (language, abstracts, keywords)', () => {
      const metadata: OkfFrontmatterV2 = {
         type: 'document',
         title: 'Maintenance et fiabilité',
         description: 'Rôle de la maintenance dans la fiabilité.',
         tags: ['maintenance', 'fiabilite'],
         language: 'fr',
         originalLanguage: 'fr',
         abstracts: {
            en: 'Practical technical guide detailing maintenance intervals and reliability.',
            ar: 'دليل تقني عملي يفصل فترات الصيانة والموثوقية.',
         },
         keywords: {
            en: ['maintenance', 'reliability', 'intervals'],
            ar: ['صيانة', 'موثوقية', 'فترات'],
         },
      };

      const serialized = serializeOkfDocument(metadata, '# Contenu');
      const parsed = parseOkfDocument(serialized);

      expect(parsed.metadata.language).toBe('fr');
      expect(parsed.metadata.originalLanguage).toBe('fr');
      expect(parsed.metadata.abstracts?.en).toContain('Practical technical guide');
      expect(parsed.metadata.abstracts?.ar).toContain('دليل تقني عملي');
      expect(parsed.metadata.keywords?.en).toEqual(['maintenance', 'reliability', 'intervals']);
      expect(parsed.metadata.keywords?.ar).toEqual(['صيانة', 'موثوقية', 'فترات']);
   });
});
