import { CatalogEntryChunk } from './types';

/**
 * Normalizes text into a clean lowercase URL/filesystem slug.
 */
export function slugify(text: string): string {
   return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      .slice(0, 80);
}

export interface CatalogEntryDescriptor {
   title: string;
   scientificName?: string;
   family?: string;
   pageRange?: string;
   startMarker: string;
}

/**
 * Slices raw monograph text into ordered catalog entry chunks based on explicit markers or titles.
 */
export function sliceCatalogEntriesByDescriptors(
   rawText: string,
   descriptors: CatalogEntryDescriptor[]
): CatalogEntryChunk[] {
   const chunks: CatalogEntryChunk[] = [];

   // Locate position of each descriptor's start marker
   const positions: Array<{ desc: CatalogEntryDescriptor; index: number }> = [];

   for (const desc of descriptors) {
      const idx = rawText.indexOf(desc.startMarker);
      if (idx !== -1) {
         positions.push({ desc, index: idx });
      }
   }

   // Sort descriptors strictly by their sequential appearance in the text
   positions.sort((a, b) => a.index - b.index);

   for (const [i, current] of positions.entries()) {
      const nextIndex = positions.at(i + 1)?.index ?? rawText.length;
      const textSlice = rawText.substring(current.index, nextIndex).trim();

      const sequence = i + 1;
      const slug = `${String(sequence).padStart(3, '0')}-${slugify(current.desc.title)}`;

      chunks.push({
         sequence,
         rawTitle: current.desc.title,
         slug,
         scientificName: current.desc.scientificName,
         family: current.desc.family,
         pageRange: current.desc.pageRange,
         text: textSlice,
      });
   }

   return chunks;
}

/**
 * Generic entry boundary detector for encyclopedias where entries are delineated by headers or page markers.
 */
export function detectCatalogEntriesRegex(
   rawText: string,
   entryHeaderRegex: RegExp,
   options: { minLength?: number } = {}
): CatalogEntryChunk[] {
   const minLength = options.minLength || 500;
   const chunks: CatalogEntryChunk[] = [];

   const matches: Array<{ title: string; index: number }> = [];
   let match: RegExpExecArray | null;

   let currentOffset = 0;
   while (currentOffset < rawText.length) {
      entryHeaderRegex.lastIndex = 0;
      const slice = rawText.slice(currentOffset);
      const match = entryHeaderRegex.exec(slice);
      if (!match) {
         break;
      }
      const title = match[1] || match[0];
      matches.push({ title: title.trim(), index: currentOffset + match.index });
      currentOffset += match.index + Math.max(1, match[0].length);
   }

   for (const [i, current] of matches.entries()) {
      const nextIndex = matches.at(i + 1)?.index ?? rawText.length;
      const textSlice = rawText.substring(current.index, nextIndex).trim();

      if (textSlice.length >= minLength) {
         const sequence = chunks.length + 1;
         const slug = `${String(sequence).padStart(3, '0')}-${slugify(current.title)}`;

         chunks.push({
            sequence,
            rawTitle: current.title,
            slug,
            text: textSlice,
         });
      }
   }

   return chunks;
}
