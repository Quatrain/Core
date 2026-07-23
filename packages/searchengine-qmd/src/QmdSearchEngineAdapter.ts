import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {
   AbstractSearchEngineAdapter,
   SearchDocument,
   SearchQueryOptions,
   SearchResultItem,
   SearchEngineParameters
} from '@quatrain/searchengine';

const execAsync = promisify(exec);

export interface QmdEngineConfig {
   /** Name of the QMD collection. Default: 'default'. */
   collectionName?: string;
   /** Root directory storing Markdown files for indexing. */
   storageDir?: string;
   /** Path to QMD CLI binary. Default: 'qmd'. */
   qmdExecutable?: string;
   /** Force execution via CLI binary when available. Default: auto-detect. */
   preferCli?: boolean;
}

/**
 * Concrete Search Engine Adapter implementing QMD (Query Markup Documents) hybrid search.
 */
export class QmdSearchEngineAdapter extends AbstractSearchEngineAdapter {
   private _collectionName: string;
   private _storageDir: string;
   private _qmdExecutable: string;
   private _preferCli: boolean;
   private _cliAvailable: boolean = false;
   private _inMemoryDocs: Map<string, SearchDocument> = new Map();

   constructor(params: SearchEngineParameters) {
      super(params);
      const config: QmdEngineConfig = params.config || {};
      this._collectionName = config.collectionName || 'default';
      this._storageDir = config.storageDir ? path.resolve(config.storageDir) : path.resolve(process.cwd(), '.qmd');
      this._qmdExecutable = config.qmdExecutable || 'qmd';
      this._preferCli = config.preferCli !== undefined ? config.preferCli : false;
   }

   /**
    * Gets storage directory location.
    */
   public get storageDir(): string {
      return this._storageDir;
   }

   /**
    * Gets configured collection name.
    */
   public get collectionName(): string {
      return this._collectionName;
   }

   /**
    * Initializes storage directory and detects CLI availability.
    */
   async initialize(): Promise<void> {
      if (!fs.existsSync(this._storageDir)) {
         fs.mkdirSync(this._storageDir, { recursive: true });
      }

      if (this._preferCli) {
         try {
            await execAsync(`${this._qmdExecutable} --version`);
            this._cliAvailable = true;
         } catch {
            this._cliAvailable = false;
         }
      }
   }

   /**
    * Indexes a document into the storage directory and memory repository.
    *
    * @param doc - Document to be indexed.
    */
   async indexDocument(doc: SearchDocument): Promise<void> {
      if (!doc || !doc.id) {
         throw new Error('QmdSearchEngineAdapter.indexDocument: Document id is required');
      }

      this._inMemoryDocs.set(doc.id, doc);

      // Persist Markdown file to disk
      const categoryDir = doc.category ? path.join(this._storageDir, doc.category) : this._storageDir;
      if (!fs.existsSync(categoryDir)) {
         fs.mkdirSync(categoryDir, { recursive: true });
      }

      const fileName = `${doc.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
      const filePath = doc.path || path.join(categoryDir, fileName);

      const frontmatter = [
         '---',
         `id: ${JSON.stringify(doc.id)}`,
         `title: ${JSON.stringify(doc.title)}`,
         doc.category ? `category: ${JSON.stringify(doc.category)}` : null,
         doc.tags ? `tags: ${JSON.stringify(doc.tags)}` : null,
         '---',
         '',
         doc.content
      ].filter(Boolean).join('\n');

      fs.writeFileSync(filePath, frontmatter, 'utf-8');

      // Execute QMD CLI index if available
      if (this._cliAvailable) {
         try {
            await execAsync(`${this._qmdExecutable} index`);
         } catch (e) {
            // Log or fallback quietly
         }
      }
   }

   /**
    * Removes a document from the index.
    *
    * @param id - Document identifier.
    */
   async removeDocument(id: string): Promise<void> {
      const doc = this._inMemoryDocs.get(id);
      this._inMemoryDocs.delete(id);

      if (doc && doc.path && fs.existsSync(doc.path)) {
         try {
            fs.unlinkSync(doc.path);
         } catch (e) {
            // Ignore missing file errors
         }
      }
   }

   /**
    * Executes a query against QMD or fallback search pipeline.
    *
    * @param query - Free text search query string.
    * @param options - Search parameters (limit, category, mode, rerank).
    * @returns Ranked search result items.
    */
   async search(query: string, options?: SearchQueryOptions): Promise<SearchResultItem[]> {
      const limit = options?.limit || 20;
      const category = options?.category;
      const mode = options?.mode || 'hybrid';

      if (this._cliAvailable) {
         try {
            const cliSubcommand = mode === 'vector' ? 'vsearch' : 'query';
            const cmd = `${this._qmdExecutable} ${cliSubcommand} "${query.replace(/"/g, '\\"')}" --json`;
            const { stdout } = await execAsync(cmd);
            const parsed = JSON.parse(stdout);

            if (Array.isArray(parsed)) {
               return parsed.slice(0, limit).map(item => ({
                  id: item.id || item.path,
                  title: item.title || item.name || 'Untitled',
                  path: item.path,
                  score: item.score || 1.0,
                  snippet: item.snippet || item.content || ''
               }));
            }
         } catch {
            // Fallback to internal search engine on CLI execution failure
         }
      }

      // Internal fallback hybrid & BM25 search
      const results: SearchResultItem[] = [];
      const normalizedQuery = query.toLowerCase().trim();
      const terms = normalizedQuery.split(/\s+/).filter(Boolean);

      for (const doc of this._inMemoryDocs.values()) {
         if (category && doc.category !== category && !doc.category?.startsWith(category + '/')) {
            continue;
         }

         const titleLower = doc.title.toLowerCase();
         const contentLower = doc.content.toLowerCase();
         const summaryLower = (doc.summary || '').toLowerCase();

         let matches = 0;
         let score = 0;

         for (const term of terms) {
            if (titleLower.includes(term)) {
               matches++;
               score += 3.0;
            }
            if (summaryLower.includes(term)) {
               matches++;
               score += 2.0;
            }
            if (contentLower.includes(term)) {
               matches++;
               score += 1.0;
            }
            if (doc.tags?.some(tag => tag.toLowerCase().includes(term))) {
               matches++;
               score += 2.5;
            }
         }

         if (matches > 0 || terms.length === 0) {
            const snippetIndex = contentLower.indexOf(terms[0] || '');
            let snippet = doc.summary || doc.content;
            if (snippetIndex !== -1 && !doc.summary) {
               const start = Math.max(0, snippetIndex - 30);
               const end = Math.min(doc.content.length, snippetIndex + 100);
               snippet = (start > 0 ? '...' : '') + doc.content.substring(start, end) + (end < doc.content.length ? '...' : '');
            }

            results.push({
               id: doc.id,
               title: doc.title,
               path: doc.path,
               score,
               snippet,
               metadata: { category: doc.category, tags: doc.tags }
            });
         }
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
   }

   /**
    * Clears all storage files and in-memory indexes.
    */
   async clearIndex(): Promise<void> {
      this._inMemoryDocs.clear();
      if (fs.existsSync(this._storageDir)) {
         try {
            fs.rmSync(this._storageDir, { recursive: true, force: true });
            fs.mkdirSync(this._storageDir, { recursive: true });
         } catch {
            // Ignore error
         }
      }
   }
}
