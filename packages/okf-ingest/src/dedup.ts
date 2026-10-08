import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { DedupEntry, DedupStats } from './types';

/**
 * Manages SHA-256 deduplication cache with token cost accounting and git repository sync.
 */
export class OkfDedupCache {
   private cache: Map<string, DedupEntry> = new Map();
   private dirty = false;

   constructor(private filePath: string) {}

   /**
    * Loads the cache from disk if it exists.
    */
   async load(): Promise<void> {
      try {
         const raw = await fs.readFile(this.filePath, 'utf-8');
         const data = JSON.parse(raw) as Record<string, DedupEntry>;
         this.cache = new Map(Object.entries(data));
      } catch {
         this.cache = new Map();
      }
   }

   /**
    * Checks if a document hash is already known.
    */
   isKnown(hash: string): boolean {
      return this.cache.has(hash);
   }

   /**
    * Retrieves cache entry by file hash.
    */
   get(hash: string): DedupEntry | undefined {
      return this.cache.get(hash);
   }

   /**
    * Registers a new or updated entry in the cache.
    */
   register(hash: string, entry: DedupEntry): void {
      this.cache.set(hash, entry);
      this.dirty = true;
   }

   /**
    * Saves dirty cache to disk.
    */
   async save(): Promise<void> {
      if (!this.dirty) return;
      const data: Record<string, DedupEntry> = Object.fromEntries(this.cache);
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      this.dirty = false;
   }

   /**
    * Reconstructs or updates the dedup cache by reading existing OKF markdown files in a Git repository.
    *
    * @param gitLocalPath - Root path of the Git repository.
    * @returns Number of newly synchronized documents.
    */
   async syncFromGitRepo(gitLocalPath: string): Promise<number> {
      let importedCount = 0;
      try {
         const contentDir = path.join(gitLocalPath, 'content');
         const entries = await fs.readdir(contentDir, { withFileTypes: true });

         for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const categoryDir = path.join(contentDir, entry.name);
            const files = await fs.readdir(categoryDir);

            for (const f of files) {
               if (!f.endsWith('.md') || f === 'index.md') continue;
               try {
                  const content = await fs.readFile(path.join(categoryDir, f), 'utf-8');
                  const match = content.match(/fileHash:\s*([a-f0-9]{64})/i);
                  if (match && !this.cache.has(match[1])) {
                     this.cache.set(match[1], {
                        filename: f,
                        ingestedAt: 'git-repo',
                        category: entry.name,
                     });
                     importedCount++;
                  }
               } catch {
                  // Ignore corrupted or unreadable files
               }
            }
         }

         if (importedCount > 0) {
            this.dirty = true;
         }
      } catch {
         // Silently return if content directory does not exist yet
      }

      return importedCount;
   }

   /**
    * Aggregates token and cost statistics across all ingested items.
    */
   getStats(): DedupStats {
      let totalTokens = 0;
      let totalCostUsd = 0;

      for (const entry of this.cache.values()) {
         if (entry.tokens) {
            totalTokens += entry.tokens.total || 0;
            totalCostUsd += entry.tokens.costUsd || 0;
         }
      }

      return {
         totalFiles: this.cache.size,
         totalTokens,
         totalCostUsd: Number(totalCostUsd.toFixed(6)),
      };
   }

   get size(): number {
      return this.cache.size;
   }
}
