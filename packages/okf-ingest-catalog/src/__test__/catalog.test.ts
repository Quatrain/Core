import { describe, expect, it } from 'bun:test';
import { parseOkfDocument, serializeOkfDocument } from '@quatrain/okf-ingest';
import { detectCatalogEntriesRegex, sliceCatalogEntriesByDescriptors, slugify } from '../detector';
import { OkfCatalogEntryMetadata } from '../types';

describe('OKF Ingest Catalog Package', () => {
   describe('slugify', () => {
      it('should create URL and directory friendly slugs without diacritics', () => {
         expect(slugify('Chardon des champs (Cirsium arvense)')).toBe('chardon-des-champs-cirsium-arvense');
         expect(slugify('01 - Érable de Montpellier')).toBe('01-erable-de-montpellier');
      });
   });

   describe('sliceCatalogEntriesByDescriptors', () => {
      it('should slice text into ordered sequential chunks with parent metadata', () => {
         const rawBookText = `ENCYCLOPEDIE DES PLANTES
Page de garde...

ACHILLÉE MILLEFEUILLE
Achillea millefolium - Asteraceae
Cette plante indique des sols équilibrés et vivants...

CHARDON DES CHAMPS
Cirsium arvense - Asteraceae
Cette plante indique un blocage du phosphore et une compaction...

PISSENLIT
Taraxacum officinale - Asteraceae
Cette plante indique un excès d'azote et un compactage...`;

         const descriptors = [
            {
               title: 'Achillée millefeuille',
               scientificName: 'Achillea millefolium',
               family: 'Asteraceae',
               startMarker: 'ACHILLÉE MILLEFEUILLE',
            },
            {
               title: 'Chardon des champs',
               scientificName: 'Cirsium arvense',
               family: 'Asteraceae',
               startMarker: 'CHARDON DES CHAMPS',
            },
            {
               title: 'Pissenlit',
               scientificName: 'Taraxacum officinale',
               family: 'Asteraceae',
               startMarker: 'PISSENLIT',
            },
         ];

         const chunks = sliceCatalogEntriesByDescriptors(rawBookText, descriptors);

         expect(chunks.length).toBe(3);
         expect(chunks[0].sequence).toBe(1);
         expect(chunks[0].rawTitle).toBe('Achillée millefeuille');
         expect(chunks[0].slug).toBe('001-achillee-millefeuille');
         expect(chunks[0].text).toContain('sols équilibrés et vivants');
         expect(chunks[0].text).not.toContain('CHARDON DES CHAMPS');

         expect(chunks[1].sequence).toBe(2);
         expect(chunks[1].rawTitle).toBe('Chardon des champs');
         expect(chunks[1].slug).toBe('002-chardon-des-champs');
         expect(chunks[1].text).toContain('blocage du phosphore');

         expect(chunks[2].sequence).toBe(3);
         expect(chunks[2].rawTitle).toBe('Pissenlit');
         expect(chunks[2].slug).toBe('003-pissenlit');
         expect(chunks[2].text).toContain("excès d'azote");
      });
   });

   describe('detectCatalogEntriesRegex', () => {
      it('should detect entries by regex header and respect minimum length', () => {
         const sampleText = `--- FICHE 1 : Allium ursinum ---
Texte de l'ail des ours sur plusieurs lignes détaillant son écologie...
Au moins 100 caractères de contenu botanique riche pour passer le filtre.

--- FICHE 2 : Urtica dioica ---
Texte de la grande ortie sur plusieurs lignes avec des descriptions...
Au moins 100 caractères de contenu agronomique pour satisfaire la longueur minimale.`;

         const regex = /^---\s*FICHE\s*\d+\s*:\s*(.+?)\s*---$/gm;
         const chunks = detectCatalogEntriesRegex(sampleText, regex, { minLength: 50 });

         expect(chunks.length).toBe(2);
         expect(chunks[0].sequence).toBe(1);
         expect(chunks[0].rawTitle).toBe('Allium ursinum');
         expect(chunks[0].slug).toBe('001-allium-ursinum');
         expect(chunks[1].sequence).toBe(2);
         expect(chunks[1].rawTitle).toBe('Urtica dioica');
         expect(chunks[1].slug).toBe('002-urtica-dioica');
      });
   });

   describe('OKF Catalog Entry Serialization', () => {
      it('should serialize and deserialize an entry with sequence and lineage contract faithfully', () => {
         const metadata: OkfCatalogEntryMetadata = {
            type: 'plant-profile',
            title: 'Chardon des champs (Cirsium arvense)',
            description: 'Plante bio-indicatrice des sols compactés et des blocages de phosphore.',
            tags: ['bio-indication', 'adventice', 'ducerf-vol-3'],
            status: 'draft',
            sequence: 42,
            pageRange: '128-130',
            scientificName: 'Cirsium arvense',
            family: 'Asteraceae',
            diagnosticKeys: ['blocage phosphore', 'anaérobiose', 'tassement'],
            parentBook: {
               title: "L'encyclopédie des plantes bio-indicatrices - Volume 3",
               slug: 'encyclopedie-des-plantes-bio-indicatrices-vol-3',
               resource: 'originals/agronomie-livres/ducerf-vol3.pdf',
               fileHash: 'abcdef1234567890',
            },
            language: 'fr',
            originalLanguage: 'fr',
            abstracts: {
               fr: 'Indicateur de compactage et de blocage du phosphore.',
               en: 'Indicator of soil compaction and phosphorus lockup.',
               ar: 'مؤشر على انضغاط التربة وتثبيت الفوسفور.',
            },
            keywords: {
               fr: ['chardon', 'bio-indication'],
               en: ['creeping thistle', 'bio-indicator'],
               ar: ['شوك الحقول', 'مؤشر حيوي'],
            },
         };

         const body = `# Chardon des champs (Cirsium arvense)\n\nContenu détaillé...`;
         const serialized = serializeOkfDocument(metadata, body);

         expect(serialized).toContain('type: plant-profile');
         expect(serialized).toContain('sequence: 42');
         expect(serialized).toContain("title: L'encyclopédie des plantes bio-indicatrices - Volume 3");
         expect(serialized).toContain('scientificName: Cirsium arvense');
         expect(serialized).toContain('fr: Indicateur de compactage');
         expect(serialized).toContain('en: Indicator of soil compaction');
         expect(serialized).toContain('ar: مؤشر على انضغاط التربة');

         const parsed = parseOkfDocument(serialized);
         const parsedMeta = parsed.metadata as unknown as OkfCatalogEntryMetadata;
         expect(parsedMeta.sequence).toBe(42);
         expect(parsedMeta.scientificName).toBe('Cirsium arvense');
         expect(parsedMeta.parentBook.slug).toBe('encyclopedie-des-plantes-bio-indicatrices-vol-3');
         expect(parsed.body).toContain('Contenu détaillé...');
      });
   });

   describe('Composable Architecture & Decoupled Runners for Catalogs', () => {
      it('should generate International English prompt for catalog entry extraction', () => {
         const { buildCatalogEntryPrompt } = require('../prompts/catalogEntryPrompt');
         const prompt = buildCatalogEntryPrompt({
            chunk: {
               sequence: 1,
               rawTitle: 'Acanthe',
               slug: '001-acanthe',
               pageRange: '50-51',
               text: 'Acanthus mollis, famille des Acanthacées...',
            },
            parentBook: {
               title: 'Encyclopédie des plantes',
               slug: 'encyclopedie-des-plantes',
               resource: 'test.pdf',
               fileHash: '123456',
            },
         });

         expect(prompt).toContain('You are an expert taxonomist and knowledge engineer specializing in encyclopedic knowledge synthesis');
         expect(prompt).toContain('1. "title": Clean primary common or vernacular entry name');
         expect(prompt).toContain('2. "scientificName": Canonical Latin binomial');
         expect(prompt).toContain('4. "description": Exactly ONE concise sentence');
         expect(prompt).not.toContain('Tu es un ingénieur agronome');
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
                  title: 'Acanthe à feuilles molles (Acanthus mollis)',
                  scientificName: 'Acanthus mollis',
                  family: 'Acanthaceae',
                  description: 'Plante vivace méditerranéenne aux grandes feuilles lobées.',
                  language: 'fr',
                  originalLanguage: 'fr',
                  abstracts: {
                     en: 'Perennial Mediterranean plant with large lobed leaves.',
                     fr: 'Plante vivace méditerranéenne aux grandes feuilles lobées.',
                     ar: 'نبات معمر متوسطي بأوراق مفصصة كبيرة.',
                  },
                  keywords: {
                     en: ['bear breeches', 'mediterranean'],
                     fr: ['acanthe', 'méditerranée'],
                     ar: ['شوك الجمل', 'متوسطي'],
                  },
                  tags: ['botany', 'mediterranean'],
                  properties: ['ornamental', 'medicinal'],
               };
            }
         }

         const mockAdapter = new MockAiAdapter();

         const result = await extractCatalogEntryContent(
            {
               sequence: 1,
               rawTitle: 'Acanthe',
               slug: '001-acanthe',
               pageRange: '50-51',
               text: 'Acanthe à feuilles molles...',
            },
            {
               adapter: mockAdapter,
               parentBook: {
                  title: 'Encyclopédie des plantes',
                  slug: 'encyclopedie-des-plantes',
                  resource: 'test.pdf',
                  fileHash: '123456',
               },
            }
         );

         expect(result.metadata.type).toBe('catalog-entry');
         expect(result.metadata.scientificName).toBe('Acanthus mollis');
         expect(result.metadata.family).toBe('Acanthaceae');
         expect(result.metadata.sequence).toBe(1);
         expect(result.usage.total).toBe(120);
         expect(result.body).toContain('**Taxonomy / Classification:** *Acanthus mollis* | **Family / Group:** Acanthaceae');
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
                  title: 'Meadowsweet (Filipendula ulmaria)',
                  scientificName: 'Filipendula ulmaria',
                  family: 'Rosaceae',
                  description: 'Perennial herb in wet soils.',
                  language: 'en',
                  originalLanguage: 'en',
                  abstracts: {
                     en: 'High density English summary of Meadowsweet.',
                     de: 'Dichte deutsche Zusammenfassung von Mädesüß.',
                  },
                  keywords: {
                     en: ['meadowsweet', 'wetlands'],
                     de: ['mädesüß', 'feuchtgebiete'],
                  },
                  tags: ['herb', 'wetlands'],
                  properties: ['salicylic acid precursor', 'anti-inflammatory'],
               };
            }
         }

         const mockAdapter = new MockLangAdapter();

         const result = await extractCatalogEntryContent(
            {
               sequence: 2,
               rawTitle: 'Reine des prés',
               slug: '002-reine-des-pres',
               pageRange: '100-102',
               text: 'Filipendula ulmaria dans les prairies humides...',
            },
            {
               adapter: mockAdapter,
               targetLanguages: ['en', 'de'],
               parentBook: {
                  title: 'European Medicinal Flora',
                  slug: 'european-medicinal-flora',
                  resource: 'flora.pdf',
                  fileHash: 'flora123',
               },
            }
         );

         expect(mockAdapter.lastPrompt).toContain('en, de');
         expect(result.metadata.abstracts?.en).toContain('High density English summary');
         expect(result.metadata.abstracts?.de).toContain('Dichte deutsche Zusammenfassung');
         expect(result.metadata.keywords?.de).toEqual(['mädesüß', 'feuchtgebiete']);
         expect(result.metadata.language).toBe('en');
      });
   });
});
