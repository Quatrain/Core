import { describe, expect, it } from 'bun:test';
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
});
