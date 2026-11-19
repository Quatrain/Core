import { describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { AbstractAiAdapter } from '@quatrain/ai';
import { parseOkfDocument, serializeOkfDocument } from '@quatrain/okf-ingest';
import { detectCatalogEntriesRegex, sliceCatalogEntriesByDescriptors, slugify } from '../detector';
import { OkfCatalogEntryMetadata } from '../types';

describe('OKF Ingest Catalog Package', () => {
   describe('slugify', () => {
      it('should create URL and directory friendly slugs without diacritics', () => {
         expect(slugify('Quartz rose (Silice cristalline)')).toBe('quartz-rose-silice-cristalline');
         expect(slugify('01 - Épidote de Montréal')).toBe('01-epidote-de-montreal');
      });
   });

   describe('sliceCatalogEntriesByDescriptors', () => {
      it('should slice text into ordered sequential chunks with parent metadata', () => {
         const rawBookText = `CATALOGUE DES MINÉRAUX
Page de garde...

QUARTZ HYALIN
SiO2 - Silicates
Ce minéral forme des cristaux prismatiques transparents...

CALCITE SPATHIQUE
CaCO3 - Carbonates
Ce minéral réagit à l'acide et présente un clivage parfait...

PYRITE
FeS2 - Sulfures
Ce minéral présente un éclat métallique doré...`;

         const descriptors = [
            {
               title: 'Quartz hyalin',
               scientificName: 'SiO2',
               family: 'Silicates',
               startMarker: 'QUARTZ HYALIN',
            },
            {
               title: 'Calcite spathique',
               scientificName: 'CaCO3',
               family: 'Carbonates',
               startMarker: 'CALCITE SPATHIQUE',
            },
            {
               title: 'Pyrite',
               scientificName: 'FeS2',
               family: 'Sulfures',
               startMarker: 'PYRITE',
            },
         ];

         const chunks = sliceCatalogEntriesByDescriptors(rawBookText, descriptors);

         expect(chunks.length).toBe(3);
         expect(chunks[0].sequence).toBe(1);
         expect(chunks[0].rawTitle).toBe('Quartz hyalin');
         expect(chunks[0].slug).toBe('001-quartz-hyalin');
         expect(chunks[0].text).toContain('cristaux prismatiques transparents');
         expect(chunks[0].text).not.toContain('CALCITE SPATHIQUE');

         expect(chunks[1].sequence).toBe(2);
         expect(chunks[1].rawTitle).toBe('Calcite spathique');
         expect(chunks[1].slug).toBe('002-calcite-spathique');
         expect(chunks[1].text).toContain('clivage parfait');

         expect(chunks[2].sequence).toBe(3);
         expect(chunks[2].rawTitle).toBe('Pyrite');
         expect(chunks[2].slug).toBe('003-pyrite');
         expect(chunks[2].text).toContain('éclat métallique');
      });
   });

   describe('detectCatalogEntriesRegex', () => {
      it('should detect entries by regex header and respect minimum length', () => {
         const sampleText = `--- FICHE 1 : Galena ---
Texte sur la galène sur plusieurs lignes détaillant sa cristallographie...
Au moins 100 caractères de contenu descriptif riche pour passer le filtre.

--- FICHE 2 : Fluorite ---
Texte sur la fluorine sur plusieurs lignes avec des descriptions...
Au moins 100 caractères de contenu technique pour satisfaire la longueur minimale.`;

         const regex = /^---\s*FICHE\s*\d+\s*:\s*(.+?)\s*---$/gm;
         const chunks = detectCatalogEntriesRegex(sampleText, regex, { minLength: 50 });

         expect(chunks.length).toBe(2);
         expect(chunks[0].sequence).toBe(1);
         expect(chunks[0].rawTitle).toBe('Galena');
         expect(chunks[0].slug).toBe('001-galena');
         expect(chunks[1].sequence).toBe(2);
         expect(chunks[1].rawTitle).toBe('Fluorite');
         expect(chunks[1].slug).toBe('002-fluorite');
      });
   });

   describe('OKF Catalog Entry Serialization', () => {
      it('should serialize and deserialize an entry with sequence and lineage contract faithfully', () => {
         const metadata: OkfCatalogEntryMetadata = {
            type: 'mineral-profile',
            title: 'Calcite spathique (CaCO3)',
            description: 'Carbonate de calcium au clivage rhomboédrique parfait.',
            tags: ['carbonates', 'clivage', 'catalogue-vol-3'],
            status: 'draft',
            sequence: 42,
            pageRange: '128-130',
            scientificName: 'CaCO3',
            family: 'Carbonates',
            diagnosticKeys: ['effervescence à l\'acide', 'clivage parfait', 'dureté 3'],
            parentBook: {
               title: "L'encyclopédie des minéraux - Volume 3",
               slug: 'encyclopedie-des-mineraux-vol-3',
               resource: 'originals/catalogues/mineraux-vol3.pdf',
               fileHash: 'abcdef1234567890',
            },
            language: 'fr',
            originalLanguage: 'fr',
            abstracts: {
               fr: 'Minéral carbonaté effervescent à clivage parfait.',
               en: 'Effervescent carbonate mineral with perfect cleavage.',
               ar: 'معدن كربوني فوار ذو انفصام تام.',
            },
            keywords: {
               fr: ['calcite', 'carbonate'],
               en: ['calcite', 'carbonate'],
               ar: ['كالسيت', 'كربونات'],
            },
         };

         const body = `# Calcite spathique (CaCO3)\n\nContenu détaillé...`;
         const serialized = serializeOkfDocument(metadata, body);

         expect(serialized).toContain('type: mineral-profile');
         expect(serialized).toContain('sequence: 42');
         expect(serialized).toContain("title: L'encyclopédie des minéraux - Volume 3");
         expect(serialized).toContain('scientificName: CaCO3');
         expect(serialized).toContain('fr: Minéral carbonaté effervescent');
         expect(serialized).toContain('en: Effervescent carbonate mineral');
         expect(serialized).toContain('ar: معدن كربوني فوار');

         const parsed = parseOkfDocument(serialized);
         const parsedMeta = parsed.metadata as unknown as OkfCatalogEntryMetadata;
         expect(parsedMeta.sequence).toBe(42);
         expect(parsedMeta.scientificName).toBe('CaCO3');
         expect(parsedMeta.parentBook.slug).toBe('encyclopedie-des-mineraux-vol-3');
         expect(parsed.body).toContain('Contenu détaillé...');
      });
   });

   describe('Composable Architecture & Decoupled Runners for Catalogs', () => {
      it('should generate International English prompt for catalog entry extraction', () => {
         const { buildCatalogEntryPrompt } = require('../prompts/catalogEntryPrompt');
         const prompt = buildCatalogEntryPrompt({
            chunk: {
               sequence: 1,
               rawTitle: 'Quartz',
               slug: '001-quartz',
               pageRange: '50-51',
               text: 'Quartz, famille des silicates...',
            },
            parentBook: {
               title: 'Encyclopédie des minéraux',
               slug: 'encyclopedie-des-mineraux',
               resource: 'test.pdf',
               fileHash: '123456',
            },
         });

         expect(prompt).toContain('You are an expert cataloguer and knowledge engineer specializing in encyclopedic knowledge synthesis');
         expect(prompt).toContain('1. "title": Clean primary common or vernacular entry name');
         expect(prompt).toContain('2. "scientificName": Canonical scientific name');
         expect(prompt).toContain('4. "description": Exactly ONE concise sentence');
         expect(prompt).not.toContain('Tu es un ingénieur');
      });

      it('should extract catalog entry using a decoupled AbstractAiAdapter and assign standard catalog-entry type', async () => {
         const { AbstractAiAdapter } = require('@quatrain/ai');
         const { extractCatalogEntryContent } = require('../ai');

         class MockAiAdapter extends AbstractAiAdapter {
            public lastPrompt = '';
            init(): void {}
            async generateText(_prompt: string): Promise<string> {
               return '{}';
            }
            async generateStructured(prompt: unknown, _schema: unknown, options?: unknown): Promise<unknown> {
               this.lastPrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
               if (options && typeof options === 'object' && 'onUsage' in options) {
                  const onUsage = (options as { onUsage?: (u: unknown) => void }).onUsage;
                  if (typeof onUsage === 'function') {
                     onUsage({
                        promptTokenCount: 80,
                        candidatesTokenCount: 40,
                        totalTokenCount: 120,
                     });
                  }
               }
               return {
                  title: 'Quartz hyalin (SiO2)',
                  scientificName: 'SiO2',
                  family: 'Silicates',
                  description: 'Silice cristalline aux prismes hexagonaux.',
                  language: 'fr',
                  originalLanguage: 'fr',
                  abstracts: {
                     en: 'Crystalline silica with hexagonal prisms.',
                     fr: 'Silice cristalline aux prismes hexagonaux.',
                     ar: 'سيليكا متبلورة بمناشير سداسية.',
                  },
                  keywords: {
                     en: ['quartz', 'silica'],
                     fr: ['quartz', 'silice'],
                     ar: ['كوارتز', 'سيليكا'],
                  },
                  tags: ['mineralogy', 'silicates'],
                  properties: ['piezoelectric', 'optical'],
               };
            }
         }

         const mockAdapter = new MockAiAdapter();

         const result = await extractCatalogEntryContent(
            {
               sequence: 1,
               rawTitle: 'Quartz',
               slug: '001-quartz',
               pageRange: '50-51',
               text: 'Quartz hyalin...',
            },
            {
               adapter: mockAdapter,
               parentBook: {
                  title: 'Encyclopédie des minéraux',
                  slug: 'encyclopedie-des-mineraux',
                  resource: 'test.pdf',
                  fileHash: '123456',
               },
            }
         );

         expect(result.metadata.type).toBe('catalog-entry');
         expect(result.metadata.scientificName).toBe('SiO2');
         expect(result.metadata.family).toBe('Silicates');
         expect(result.metadata.sequence).toBe(1);
         expect(result.usage.total).toBe(120);
         expect(result.body).toContain('**Taxonomy / Classification:** *SiO2* | **Family / Group:** Silicates');
      });

      it('should support parameterized target languages for catalog entry extraction', async () => {
         const { AbstractAiAdapter } = require('@quatrain/ai');
         const { extractCatalogEntryContent } = require('../ai');

         class MockLangAdapter extends AbstractAiAdapter {
            public lastPrompt = '';
            init(): void {}
            async generateText(_prompt: string): Promise<string> {
               return '{}';
            }
            async generateStructured(prompt: unknown, _schema: unknown, options?: unknown): Promise<unknown> {
               this.lastPrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
               if (options && typeof options === 'object' && 'onUsage' in options) {
                  const onUsage = (options as { onUsage?: (u: unknown) => void }).onUsage;
                  if (typeof onUsage === 'function') {
                     onUsage({
                        promptTokenCount: 50,
                        candidatesTokenCount: 30,
                        totalTokenCount: 80,
                     });
                  }
               }
               return {
                  title: 'Fluorite (CaF2)',
                  scientificName: 'CaF2',
                  family: 'Halides',
                  description: 'Halide mineral with cubic crystals.',
                  language: 'en',
                  originalLanguage: 'en',
                  abstracts: {
                     en: 'High density English summary of fluorite.',
                     de: 'Dichte deutsche Zusammenfassung von Fluorit.',
                  },
                  keywords: {
                     en: ['fluorite', 'halides'],
                     de: ['fluorit', 'halogenide'],
                  },
                  tags: ['halides', 'fluorescence'],
                  properties: ['fluorescent', 'flux in metallurgy'],
               };
            }
         }

         const mockAdapter = new MockLangAdapter();

         const result = await extractCatalogEntryContent(
            {
               sequence: 2,
               rawTitle: 'Fluorine',
               slug: '002-fluorine',
               pageRange: '100-102',
               text: 'La fluorine en cristaux cubiques...',
            },
            {
               adapter: mockAdapter,
               targetLanguages: ['en', 'de'],
               parentBook: {
                  title: 'European Minerals',
                  slug: 'european-minerals',
                  resource: 'minerals.pdf',
                  fileHash: 'minerals123',
               },
            }
         );

         expect(mockAdapter.lastPrompt).toContain('en, de');
         expect(result.metadata.abstracts?.en).toContain('High density English summary');
         expect(result.metadata.abstracts?.de).toContain('Dichte deutsche Zusammenfassung');
         expect(result.metadata.keywords?.de).toEqual(['fluorit', 'halogenide']);
         expect(result.metadata.language).toBe('en');
      });

      it('should ingest entire catalog monograph with intro chapters, entries, and master index', async () => {
         const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-catalog-engine-'));
         try {
            class MockCatalogEngineAdapter extends AbstractAiAdapter {
               init(): void {}
               async generateText(): Promise<string> {
                  return 'mock';
               }
               async generateStructured<T>(prompt: unknown): Promise<T> {
                  const p = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
                  if (p.includes('scientificName') || p.includes('family')) {
                     return {
                        title: 'Galène',
                        scientificName: 'PbS',
                        family: 'Sulfures',
                        description: 'Sulfure de plomb.',
                        language: 'fr',
                        abstracts: { en: 'Galena summary' },
                        keywords: { en: ['galena'] },
                        tags: ['galena', 'sulfides'],
                        properties: ['lead ore', 'semiconductor'],
                     } as T;
                  }
                  return {
                     title: 'Introduction générale',
                     type: 'chapter',
                     description: 'Introduction aux principes de la minéralogie.',
                     category: 'mineralogy',
                     language: 'fr',
                     tags: ['mineralogy', 'classification'],
                  } as T;
               }
            }

            const { ingestCatalogMonograph } = await import('../engine');
            const summary = await ingestCatalogMonograph(
               {
                  bookTitle: 'Minéraux et Gemmes',
                  description: 'Traité encyclopédique de référence.',
                  category: 'mineralogy',
                  authors: ['Dr. A. Schmidt'],
                  publisher: 'Example Press',
                  publicationYear: 2024,
                  introChapters: [
                     {
                        index: 1,
                        title: 'Introduction générale',
                        slug: '01-introduction-generale',
                        text: 'Principes généraux de la minéralogie...',
                        summary: 'Méthodologie générale.',
                     },
                  ],
                  entries: [
                     {
                        sequence: 1,
                        rawTitle: 'Galène',
                        slug: '001-galene',
                        text: 'PbS. Description complète du minéral...',
                     },
                  ],
               },
               {
                  filename: 'mineraux.pdf',
                  gitLocalPath: tempDir,
                  adapter: new MockCatalogEngineAdapter(),
               }
            );

            expect(summary.bookSlug).toBe('mineraux-et-gemmes');
            expect(summary.totalEntries).toBe(1);
            expect(summary.totalChapters).toBe(1);
            expect(summary.createdFiles.length).toBe(3); // 1 intro chapter + 1 entry + 1 master index

            const masterPath = path.join(tempDir, summary.masterIndexPath);
            const masterContent = await fs.readFile(masterPath, 'utf-8');
            expect(masterContent).toContain('type: monograph');
            expect(masterContent).toContain('PbS');
            expect(masterContent).toContain('01-introduction-generale.md');
         } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
         }
      });
   });
});
