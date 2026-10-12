import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { OkfDedupCache } from '../dedup';

describe('OkfDedupCache', () => {
   let tempDir: string;
   let cacheFile: string;

   beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-dedup-test-'));
      cacheFile = path.join(tempDir, 'hashes.json');
   });

   afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
   });

   it('should register and persist entries with tokens', async () => {
      const cache = new OkfDedupCache(cacheFile);
      await cache.load();

      expect(cache.size).toBe(0);
      expect(cache.isKnown('hash123')).toBe(false);

      cache.register('hash123', {
         filename: 'test.pdf',
         ingestedAt: '2026-10-03T22:00:00.000Z',
         category: 'viticulture',
         tokens: {
            prompt: 2000,
            candidates: 400,
            thinking: 0,
            total: 2400,
            costUsd: 0.00027,
         },
      });

      expect(cache.size).toBe(1);
      expect(cache.isKnown('hash123')).toBe(true);

      await cache.save();

      // Reload in a fresh cache instance
      const cache2 = new OkfDedupCache(cacheFile);
      await cache2.load();
      expect(cache2.size).toBe(1);
      expect(cache2.isKnown('hash123')).toBe(true);

      const stats = cache2.getStats();
      expect(stats.totalFiles).toBe(1);
      expect(stats.totalTokens).toBe(2400);
      expect(stats.totalCostUsd).toBe(0.00027);
   });

   it('should sync existing markdown documents from git repository structure', async () => {
      const gitRepo = path.join(tempDir, 'repo');
      const catDir = path.join(gitRepo, 'content', 'agro');
      await fs.mkdir(catDir, { recursive: true });

      const testHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const ficheContent = `---
title: Fiche Test
type: fiche
fileHash: ${testHash}
---
# Content`;
      await fs.writeFile(path.join(catDir, 'fiche-test.md'), ficheContent, 'utf-8');
      await fs.writeFile(path.join(catDir, 'index.md'), '# Index', 'utf-8');

      const cache = new OkfDedupCache(cacheFile);
      const syncedCount = await cache.syncFromGitRepo(gitRepo);

      expect(syncedCount).toBe(1);
      expect(cache.isKnown(testHash)).toBe(true);
   });
});
