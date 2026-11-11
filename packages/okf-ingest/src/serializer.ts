import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { OkfDocument, OkfFrontmatterV2 } from './types';

export interface SerializeOptions {
   includeHeaderComment?: boolean;
}

/**
 * Cleans object to exclude null, undefined, empty strings, and empty arrays (except essential ones).
 */
export function sanitizeOkfFrontmatter(data: Record<string, unknown>): Record<string, unknown> {
   const clean: Record<string, unknown> = {};

   for (const [key, val] of Object.entries(data)) {
      if (val === null || val === undefined || val === '') {
         continue;
      }
      if (Array.isArray(val)) {
         if (val.length === 0 && key !== 'tags' && key !== 'sources') {
            continue;
         }
         Reflect.set(clean, key, val);
      } else if (typeof val === 'object') {
         const cleanedSub = sanitizeOkfFrontmatter(val as Record<string, unknown>);
         if (Object.keys(cleanedSub).length > 0) {
            Reflect.set(clean, key, cleanedSub);
         }
      } else {
         Reflect.set(clean, key, val);
      }
   }

   return clean;
}

/**
 * Builds a valid OKF v0.2 frontmatter block from structured metadata.
 *
 * @param metadata - The document metadata.
 * @param options - Configuration options.
 * @returns YAML string enclosed in `---`.
 */
export function buildOkfFrontmatter(
   metadata: OkfFrontmatterV2,
   options: SerializeOptions = { includeHeaderComment: true }
): string {
   const clean = sanitizeOkfFrontmatter(metadata as Record<string, unknown>);
   const yamlContent = stringifyYaml(clean).trim();

   if (options.includeHeaderComment) {
      return `---\n# --- Open Knowledge Format v0.2 ---\n${yamlContent}\n---`;
   }

   return `---\n${yamlContent}\n---`;
}

/**
 * Serializes an OKF v0.2 document into complete Markdown file content.
 *
 * @param metadata - Document metadata.
 * @param body - Markdown content body.
 * @param options - Formatting options.
 * @returns Full Markdown file string.
 */
export function serializeOkfDocument(
   metadata: OkfFrontmatterV2,
   body: string,
   options?: SerializeOptions
): string {
   const frontmatter = buildOkfFrontmatter(metadata, options);
   const trimmedBody = body.trim();
   return `${frontmatter}\n\n${trimmedBody}\n`;
}

/**
 * Parses an OKF Markdown file into structured metadata and content body.
 *
 * @param content - Complete Markdown file content.
 * @returns OkfDocument containing parsed metadata and body string.
 */
export function parseOkfDocument(content: string): OkfDocument {
   const trimmed = content.trim();
   if (!trimmed.startsWith('---')) {
      return {
         metadata: {
            type: 'document',
            title: 'Untitled',
            description: '',
            tags: [],
         },
         body: content,
      };
   }

   const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
   if (!match) {
      throw new Error('[OKF Parser] Malformed document: missing opening or closing --- frontmatter delimiter');
   }

   const yamlPart = match[1].trim();
   const bodyPart = match[2].trim();

   const parsed = (parseYaml(yamlPart) || {}) as Record<string, unknown>;
   const metadata: OkfFrontmatterV2 = {
      type: typeof parsed.type === 'string' ? parsed.type : 'document',
      title: typeof parsed.title === 'string' ? parsed.title : 'Untitled',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]) : [],
      ...parsed,
   };

   return {
      metadata,
      body: bodyPart,
   };
}
