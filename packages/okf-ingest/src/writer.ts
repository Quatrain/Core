import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { serializeOkfDocument } from './serializer';
import { OkfFrontmatterV2 } from './types';

export interface WriteOkfOptions {
   gitLocalPath: string;
   category: string;
   slug: string;
   metadata: OkfFrontmatterV2;
   body: string;
}

/**
 * Writes a fully-formed OKF v0.2 Markdown document into the category directory of the repository.
 *
 * @param options - Writing parameters including root, category, slug, metadata, and body.
 * @returns Relative path to the written file (e.g., content/agriculture/mon-guide.md).
 */
export async function writeOkfDocument(options: WriteOkfOptions): Promise<string> {
   const { gitLocalPath, category, slug, metadata, body } = options;
   const categoryDir = path.join(gitLocalPath, 'content', category);
   await fs.mkdir(categoryDir, { recursive: true });

   const content = serializeOkfDocument(metadata, body);
   const filePath = path.join(categoryDir, `${slug}.md`);
   await fs.writeFile(filePath, content, 'utf-8');

   return path.join('content', category, `${slug}.md`);
}
