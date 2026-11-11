import { describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeOkfDocument } from '../writer';
import { OkfFrontmatterV2 } from '../types';

describe('writeOkfDocument', () => {
   it('should write an OKF document to the expected directory with serialized content', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-writer-test-'));

      try {
         const metadata: OkfFrontmatterV2 = {
            title: 'Test Guide',
            type: 'guide',
            description: 'A test guide for unit test verification.',
            category: 'test-category',
            tags: ['test', 'unit'],
            status: 'draft',
         };
         const body = '# Test Guide\n\nThis is the guide body.';

         const relPath = await writeOkfDocument({
            gitLocalPath: tempDir,
            category: 'test-category',
            slug: 'test-guide',
            metadata,
            body,
         });

         expect(relPath).toBe(path.join('content', 'test-category', 'test-guide.md'));

         const absolutePath = path.join(tempDir, relPath);
         const content = await fs.readFile(absolutePath, 'utf-8');

         expect(content).toContain('title: Test Guide');
         expect(content).toContain('type: guide');
         expect(content).toContain('# Test Guide');
      } finally {
         await fs.rm(tempDir, { recursive: true, force: true });
      }
   });
});
