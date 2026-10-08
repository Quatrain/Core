import { describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseOkfDocument } from '../serializer';
import { BookOutlineChapter } from '../types';
import { sliceTextByChapters, slugify } from '../monograph';

describe('Monograph Decomposition Engine', () => {
   describe('slugify', () => {
      it('should produce clean lowercase slugs without diacritics or special characters', () => {
         expect(slugify('Pédologie : Sol, Végétation & Environnement !')).toBe(
            'pedologie-sol-vegetation-environnement'
         );
         expect(slugify('01 - Introduction générale')).toBe('01-introduction-generale');
      });
   });

   describe('sliceTextByChapters', () => {
      it('should slice text accurately based on startMarker anchors', () => {
         const sampleText = `TITRE DU LIVRE
PREFACE
TABLE DES MATIERES

PREMIERE PARTIE : LES SOLS VIVANTS
Voici le texte du premier chapitre qui parle de la microbiologie des sols vivants.
Fin du chapitre un.

DEUXIEME PARTIE : LES COUVERTS VEGETAUX
Voici le texte du second chapitre qui détaille les espèces de couverts végétaux.
Fin du livre.`;

         const chapters: BookOutlineChapter[] = [
            {
               index: 1,
               title: 'Les Sols Vivants',
               slug: '01-les-sols-vivants',
               startMarker: 'PREMIERE PARTIE : LES SOLS VIVANTS',
            },
            {
               index: 2,
               title: 'Les Couverts Végétaux',
               slug: '02-les-couverts-vegetaux',
               startMarker: 'DEUXIEME PARTIE : LES COUVERTS VEGETAUX',
            },
         ];

         const slices = sliceTextByChapters(sampleText, chapters);
         expect(slices.length).toBe(2);
         expect(slices[0].chapter.title).toBe('Les Sols Vivants');
         expect(slices[0].text).toContain('microbiologie des sols vivants');
         expect(slices[0].text).not.toContain('espèces de couverts végétaux');

         expect(slices[1].chapter.title).toBe('Les Couverts Végétaux');
         expect(slices[1].text).toContain('espèces de couverts végétaux');
      });

      it('should slice text by chapter titles if markers are absent', () => {
         const sampleText = `Introduction au traité.
Chapitre 1 : Genèse du profil
Détails sur la pédogenèse.
Chapitre 2 : Analyse minéralogique
Détails sur les minéraux.`;

         const chapters: BookOutlineChapter[] = [
            {
               index: 1,
               title: 'Chapitre 1 : Genèse du profil',
               slug: '01-genese-du-profil',
            },
            {
               index: 2,
               title: 'Chapitre 2 : Analyse minéralogique',
               slug: '02-analyse-mineralogique',
            },
         ];

         const slices = sliceTextByChapters(sampleText, chapters);
         expect(slices.length).toBe(2);
         expect(slices[0].text).toContain('Détails sur la pédogenèse');
         expect(slices[1].text).toContain('Détails sur les minéraux');
      });

      it('should fallback to proportional distribution if no markers match', () => {
         const longText = 'A'.repeat(1000) + 'B'.repeat(1000) + 'C'.repeat(1000);
         const chapters: BookOutlineChapter[] = [
            { index: 1, title: 'Inconnue 1', slug: '01-inconnue-1' },
            { index: 2, title: 'Inconnue 2', slug: '02-inconnue-2' },
            { index: 3, title: 'Inconnue 3', slug: '03-inconnue-3' },
         ];

         const slices = sliceTextByChapters(longText, chapters);
         expect(slices.length).toBe(3);
         expect(slices[0].text.length).toBeGreaterThan(500);
         expect(slices[1].text.length).toBeGreaterThan(500);
         expect(slices[2].text.length).toBeGreaterThan(500);
      });

      it('should handle single chapter text gracefully', () => {
         const text = 'Unique content of the document.';
         const chapters: BookOutlineChapter[] = [
            { index: 1, title: 'Monodoc', slug: '01-monodoc' },
         ];
         const slices = sliceTextByChapters(text, chapters);
         expect(slices.length).toBe(1);
         expect(slices[0].text).toBe(text);
      });
   });

   describe('decomposeAndIngestMonograph', () => {
      it('should handle single document when below split threshold', async () => {
         const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-mono-single-'));
         try {
            const { AbstractAiAdapter } = await import('@quatrain/ai');
            class MockSingleAdapter extends AbstractAiAdapter {
               init(): void {}
               async generateText(): Promise<string> {
                  return 'mock';
               }
               async generateStructured<T>(): Promise<T> {
                  return {
                     title: 'Direct Fiche',
                     type: 'fiche',
                     description: 'Direct fiche description.',
                     category: 'agronomy',
                     tags: ['soil'],
                  } as T;
               }
            }

            const { decomposeAndIngestMonograph } = await import('../monograph');
            const result = await decomposeAndIngestMonograph(
               {
                  rawText: 'Short single doc text below 60000 chars.',
                  filename: 'single-doc.pdf',
                  gitLocalPath: tempDir,
               },
               undefined,
               {
                  adapter: new MockSingleAdapter(),
                  splitThresholdChars: 100_000,
                  defaultCategory: 'agronomy',
               }
            );

            expect(result.chapterDocs.length).toBe(0);
            expect(result.allCreatedFiles.length).toBe(1);
            expect(result.allCreatedFiles[0]).toContain('content');
         } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
         }
      });

      it('should decompose multi-chapter book and create indexed structure', async () => {
         const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-mono-multi-'));
         try {
            const { AbstractAiAdapter } = await import('@quatrain/ai');
            class MockMultiAdapter extends AbstractAiAdapter {
               init(): void {}
               async generateText(): Promise<string> {
                  return 'mock';
               }
               async generateStructured<T>(prompt: unknown): Promise<T> {
                  const p = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
                  if (p.includes('book') || p.includes('outline') || p.includes('decompose')) {
                     return {
                        title: 'Grand Traité des Sols',
                        slug: 'grand-traite-des-sols',
                        description: 'Description globale du traité.',
                        category: 'soil-health',
                        tags: ['soil', 'pedology'],
                        language: 'fr',
                        chapters: [
                           { index: 1, title: 'Chapitre 1', slug: '01-chapitre-1', startMarker: 'CH1_START' },
                           { index: 2, title: 'Chapitre 2', slug: '02-chapitre-2', startMarker: 'CH2_START' },
                        ],
                     } as T;
                  }
                  return {
                     title: 'Extracted Chapter',
                     type: 'chapter',
                     description: 'Extracted chapter description.',
                     category: 'soil-health',
                     tags: ['chapter'],
                     language: 'fr',
                     originalLanguage: 'fr',
                  } as T;
               }
            }

            const rawText = `HEADER
CH1_START
Contenu du premier chapitre sur les sols vivants.
CH2_START
Contenu du second chapitre sur la minéralogie.`;

            const { decomposeAndIngestMonograph } = await import('../monograph');
            const result = await decomposeAndIngestMonograph(
               {
                  rawText,
                  filename: 'traite.pdf',
                  gitLocalPath: tempDir,
               },
               undefined,
               {
                  adapter: new MockMultiAdapter(),
                  splitThresholdChars: 10, // Force split
                  defaultCategory: 'soil-health',
               }
            );

            expect(result.chapterDocs.length).toBe(2);
            expect(result.allCreatedFiles.length).toBe(3); // 2 chapters + 1 index.md
            expect(result.masterRelativePath).toBe(path.join('content', 'soil-health', 'grand-traite-des-sols', 'index.md'));

            const indexPath = path.join(tempDir, result.masterRelativePath);
            const indexContent = await fs.readFile(indexPath, 'utf-8');
            expect(indexContent).toContain('type: monograph');
            expect(indexContent).toContain('Grand Traité des Sols');
            expect(indexContent).toContain('01-chapitre-1.md');
         } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
         }
      });
   });
});
