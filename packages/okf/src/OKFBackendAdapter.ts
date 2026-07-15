import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { 
   AbstractBackendAdapter, 
   BackendParameters, 
   DataObjectClass,
   QueryResultType,
   Filters,
   Filter,
   SortAndLimit,
   BackendError,
   Backend
} from '@quatrain/backend';
import { ObjectUri, NotFoundError } from '@quatrain/core';
import { Storage, AbstractStorageAdapter } from '@quatrain/storage';

/**
 * File-based persistence adapter conforming to the Open Knowledge Format (OKF) standard.
 * Serializes entities into flat directory layouts, optionally delegating to a Storage Adapter.
 */
export class OKFBackendAdapter extends AbstractBackendAdapter {
   protected dataDir: string;
   protected storage: AbstractStorageAdapter | null = null;

   /**
    * Instantiates the OKF storage adapter.
    * 
    * @param params - Configuration parameters containing database path and optional settings.
    */
   constructor(params?: BackendParameters) {
      const actualParams = params || {};
      super(actualParams);
      this.dataDir = (actualParams.config?.database as string) || process.env.STUDIO_DATA_DIR || '/data/okf';
      const storageAlias = actualParams.config?.storage;
      if (storageAlias) {
         this.storage = Storage.getStorage(storageAlias);
      }
   }

   /**
    * Resolves the relative storage path matching the OKF collection and metadata hierarchy.
    * For telemetry: telemetry/YYYY-MM-DD/{type}/{HHMMSS}-{millis}-{bassinId}.json
    * For other: {collection}/{uid}.json
    * 
    * @param dao - The data object model being persisted.
    * @param uid - The unique identifier of the record.
    * @returns The relative file path string.
    */
   public getOKFPath(dao: DataObjectClass<any>, uid: string): string {
      const collection = this.getCollection(dao);
      if (!collection) {
         throw new BackendError("[OKF] Cannot resolve path without collection name");
      }
      
      if (collection === 'telemetry') {
         const createdAt = dao.val('createdAt') || new Date().toISOString();
         const dateObj = new Date(createdAt);
         const yyyymmdd = dateObj.toISOString().split('T')[0];
         const timePart = dateObj.toISOString().split('T')[1].replace(/Z/g, '');
         const parts = timePart.split('.');
         const hms = parts[0];
         const ms = parts[1];
         const hhmmsstrim = hms.replace(/:/g, '');
         const millis = ms ? ms.substring(0, 3) : '000';
         const type = dao.val('type') || 'o2';
         const bassinId = dao.val('bassin') || 'unknown';
         return path.join('telemetry', yyyymmdd, type, `${hhmmsstrim}-${millis}-${bassinId}.json`);
      }

      let subfolder = '';
      if (dao.has('category') && dao.val('category')) {
         subfolder = dao.val('category');
      } else if (dao.has('folder') && dao.val('folder')) {
         subfolder = dao.val('folder');
      }

      if (subfolder) {
         return path.join(collection, subfolder, `${uid}.md`);
      }

      return path.join(collection, `${uid}.md`);
   }

   protected async _streamToString(stream: Readable): Promise<string> {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
         chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf-8');
   }

   protected serializeContent(dao: DataObjectClass<any>, relativePath: string): string {
      const collection = this.getCollection(dao);
      const json = dao.toJSON();

      if (collection === 'telemetry') {
         const payload = {
            meta: {
               version: '1.0',
               created_by: dao.val('createdBy') || 'operator@sodav.ci',
               created_at: dao.val('createdAt') || new Date().toISOString()
            },
            data: json
         };
         return JSON.stringify(payload, null, 2);
      }

      // Conforming strictly to the OKF markdown specification (flat frontmatter)
      const { body, markdown, ...restData } = json;
      
      const frontmatter: any = {
         type: dao.val('type') || dao.constructor.name || collection,
         title: dao.val('title') || undefined,
         description: dao.val('summary') || dao.val('description') || undefined,
         tags: dao.val('tags') || [],
         timestamp: dao.val('createdAt') || dao.val('timestamp') || new Date().toISOString(),
         ...restData
      };

      // Clean empty/null/undefined fields from frontmatter
      const cleanFrontmatter: any = {};
      for (const [key, val] of Object.entries(frontmatter)) {
         if (val !== null && val !== undefined && val !== '') {
            // Also skip empty arrays unless they are required/recommended fields like tags
            if (Array.isArray(val) && val.length === 0 && key !== 'tags') {
               continue;
            }
            cleanFrontmatter[key] = val;
         }
      }

      const yamlHeader = stringifyYaml(cleanFrontmatter).trim();
      const bodyContent = body || markdown || '';
      return `---\n${yamlHeader}\n---\n${bodyContent}`;
   }

   protected deserializeContent(content: string, relativePath: string): any {
      const trimmed = content.trim();
      if (relativePath.endsWith('.json') || !trimmed.startsWith('---')) {
         return JSON.parse(content);
      }

      const parts = trimmed.split('---');
      if (parts.length >= 3) {
         const yamlPart = parts[1].trim();
         const bodyPart = parts.slice(2).join('---').trim();
         const parsed = parseYaml(yamlPart);
         if (parsed) {
            // Standardize flat OKF frontmatter to Quatrain's { meta, data } structure
            let meta = parsed.meta || {};
            let data = parsed.data || {};

            if (!parsed.data && !parsed.meta) {
               // Flat frontmatter structure
               const { type, title, description, tags, timestamp, ...rest } = parsed;
               data = {
                  type: type || undefined,
                  title: title || undefined,
                  summary: description || undefined,
                  tags: tags || [],
                  createdAt: timestamp || undefined,
                  ...rest
               };
               meta = {
                  version: '1.0',
                  created_at: timestamp || undefined,
                  created_by: parsed.createdBy || parsed.created_by || 'operator@sodav.ci'
               };
            }

            // Restore body content in the parsed object if body exists
            if (bodyPart) {
               if (!data.body) {
                  data.body = bodyPart;
               }
               if (!data.markdown) {
                  data.markdown = bodyPart;
               }
            }
            return { meta, data };
         }
      }
      throw new Error(`[OKF] Failed to parse content at ${relativePath}: invalid YAML frontmatter`);
   }

   protected getFile(ref: string, mime?: string) {
      return {
         bucket: 'default',
         ref,
         name: path.basename(ref),
         mime
      };
   }

   protected async findFileRecursively(collection: string, filename: string): Promise<string | null> {
      if (this.storage) {
         if (typeof (this.storage as any).list === 'function') {
            const files: string[] = await (this.storage as any).list(collection);
            const found = files.find(f => path.basename(f) === filename);
            return found || null;
         }
         return null;
      }

      const baseColPath = path.join(this.dataDir, collection);
      const scan = async (dir: string): Promise<string | null> => {
         try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
               const fullPath = path.join(dir, entry.name);
               if (entry.isDirectory()) {
                  const found = await scan(fullPath);
                  if (found) return found;
               } else if (entry.isFile() && entry.name === filename) {
                  return path.relative(this.dataDir, fullPath);
               }
            }
         } catch (e) {
            // ignore
         }
         return null;
      };
      return await scan(baseColPath);
   }

    /**
     * Creates a new document on disk matching the OKF structure.
     * 
     * @param dao - The payload object.
     * @param desiredUid - Optional custom UID.
     * @returns The hydrated DataObject.
     */
    async create(dao: DataObjectClass<any>, desiredUid?: string): Promise<DataObjectClass<any>> {
       const uid: string = desiredUid || (dao.val('id') as string) || crypto.randomUUID();
       const relativePath = this.getOKFPath(dao, uid);
       const fullPath = path.join(this.dataDir, relativePath);

       const content = this.serializeContent(dao, relativePath);
       const mime = relativePath.endsWith('.md') ? 'text/markdown' : 'application/json';

       if (this.storage) {
          const fileType = this.getFile(relativePath, mime);
          await this.storage.create(fileType as any, Readable.from([content]));
       } else {
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content, 'utf-8');
       }

       const collection = this.getCollection(dao);
       dao.uri = new ObjectUri(`${collection}/${uid}`);
       if (collection) {
          await this.rebuildIndices(collection);
       }
       return dao;
    }

    /**
     * Hydrates a DataObject by reading its matching flat file on disk.
     * 
     * @param dao - The target skeleton DataObject.
     * @returns The populated DataObject.
     */
    async read(dao: DataObjectClass<any>): Promise<DataObjectClass<any>> {
       const uid = dao.uri.uid;
       if (!uid) {
          throw new BackendError("[OKF] Cannot read record without a valid UID");
       }
       let relativePath = this.getOKFPath(dao, uid);
       const fullPath = path.join(this.dataDir, relativePath);

       const collection = this.getCollection(dao);
       const suffix = collection === 'telemetry' ? `${uid}.json` : `${uid}.md`;

       if (this.storage) {
          let content: string;
          try {
             const stream = await this.storage.getReadable(this.getFile(relativePath) as any);
             content = await this._streamToString(stream);
          } catch (err) {
             const foundRelative = collection ? await this.findFileRecursively(collection, suffix) : null;
             if (!foundRelative) {
                throw new NotFoundError(`[OKF] Record not found in storage: ${suffix}`);
             }
             relativePath = foundRelative;
             const stream = await this.storage.getReadable(this.getFile(relativePath) as any);
             content = await this._streamToString(stream);
          }
          const parsed = this.deserializeContent(content, relativePath);
          return await dao.populate(parsed.data);
       } else {
          try {
             const raw = await fs.readFile(fullPath, 'utf-8');
             const parsed = this.deserializeContent(raw, relativePath);
             return await dao.populate(parsed.data);
          } catch (err) {
             const foundRelative = collection ? await this.findFileRecursively(collection, suffix) : null;
             if (!foundRelative) {
                throw new NotFoundError(`[OKF] Record not found at path: ${relativePath}`);
             }
             const foundFullPath = path.join(this.dataDir, foundRelative);
             const raw = await fs.readFile(foundFullPath, 'utf-8');
             const parsed = this.deserializeContent(raw, foundRelative);
             return await dao.populate(parsed.data);
          }
       }
    }

    /**
     * Overwrites the document with the updated payload.
     * 
     * @param dao - The modified payload.
     * @returns The DataObject instance.
     */
    async update(dao: DataObjectClass<any>): Promise<DataObjectClass<any>> {
       const uid = dao.uri.uid;
       if (!uid) {
          throw new BackendError("[OKF] Cannot update record without a valid UID");
       }
       const relativePath = this.getOKFPath(dao, uid);
       const fullPath = path.join(this.dataDir, relativePath);

       // Clean up old file if the path has changed (e.g. category changed)
       const collection = this.getCollection(dao);
       const suffix = collection === 'telemetry' ? `${uid}.json` : `${uid}.md`;
       const oldRelative = collection ? await this.findFileRecursively(collection, suffix) : null;
       if (oldRelative && oldRelative !== relativePath) {
          if (this.storage) {
             try {
                const deleteResult = await this.storage.delete(this.getFile(oldRelative) as any);
                Backend.info(`[OKF] Attempted delete of ${oldRelative}: result = ${deleteResult}`);
             } catch (err: any) {
                Backend.warn(`[OKF] Error deleting old record at ${oldRelative}: ${err.message}`, err);
             }
          } else {
             try {
                const oldFullPath = path.join(this.dataDir, oldRelative);
                await fs.unlink(oldFullPath);
             } catch (err: any) {
                Backend.warn(`[OKF] Error deleting old local record at ${oldRelative}: ${err.message}`);
             }
          }
       }

       const content = this.serializeContent(dao, relativePath);
       const mime = relativePath.endsWith('.md') ? 'text/markdown' : 'application/json';

       if (this.storage) {
          const fileType = this.getFile(relativePath, mime);
          await this.storage.create(fileType as any, Readable.from([content]));
       } else {
          await fs.writeFile(fullPath, content, 'utf-8');
       }
       if (collection) {
          await this.rebuildIndices(collection);
       }
       return dao;
    }

    /**
     * Deletes the file from the filesystem.
     * 
     * @param dao - The target DataObject to remove.
     * @returns The cleared DataObject.
     */
    async delete(dao: DataObjectClass<any>): Promise<DataObjectClass<any>> {
       const uid = dao.uri.uid;
       if (!uid) {
          throw new BackendError("[OKF] Cannot delete record without a valid UID");
       }
       let relativePath = this.getOKFPath(dao, uid);
       const fullPath = path.join(this.dataDir, relativePath);

       const collection = this.getCollection(dao);
       const suffix = collection === 'telemetry' ? `${uid}.json` : `${uid}.md`;

       if (this.storage) {
          try {
             await this.storage.delete(this.getFile(relativePath) as any);
          } catch (err) {
             const foundRelative = collection ? await this.findFileRecursively(collection, suffix) : null;
             if (!foundRelative) {
                throw new NotFoundError(`[OKF] Failed to delete record from storage: ${suffix}`);
             }
             await this.storage.delete(this.getFile(foundRelative) as any);
          }
       } else {
          try {
             await fs.unlink(fullPath);
          } catch (err) {
             const foundRelative = collection ? await this.findFileRecursively(collection, suffix) : null;
             if (!foundRelative) {
                throw new NotFoundError(`[OKF] Failed to delete record at path: ${relativePath}`);
             }
             const foundFullPath = path.join(this.dataDir, foundRelative);
             await fs.unlink(foundFullPath);
          }
       }

        if (collection) {
           await this.rebuildIndices(collection);
        }
        return dao;
    }

   /**
    * Recursively removes the directory associated with a collection.
    * 
    * @param collection - The collection folder path to clear.
    */
   async deleteCollection(collection: string): Promise<void> {
      if (this.storage) {
         if (typeof (this.storage as any).list === 'function') {
            try {
               const files: string[] = await (this.storage as any).list(collection);
               for (const relPath of files) {
                  await this.storage.delete(this.getFile(relPath) as any);
               }
            } catch (e) {
               // ignore
            }
         }
         return;
      }
      const colPath = path.join(this.dataDir, collection);
      await fs.rm(colPath, { recursive: true, force: true });
   }

   /**
    * Helper to flatten filters into a simple array.
    */
   protected _flattenFilters(f?: Filters | Filter[]): Filter[] {
      if (!f) return [];
      if (Array.isArray(f)) return f;
      const list: Filter[] = [];
      if (f.and) list.push(...f.and);
      if (f.or) list.push(...f.or);
      return list;
   }

   /**
    * Queries the local files by scanning directories and evaluating conditions in-memory.
    * 
    * @param dataObject - Base template representing the target collection.
    * @param filters - Active constraints.
    * @param pagination - Limits and sorting directives.
    * @returns QueryResult containing found items and diagnostics.
    */
   async find(
      dataObject: DataObjectClass<any>,
      filters?: Filters | Filter[],
      pagination?: SortAndLimit
   ): Promise<QueryResultType<any>> {
      const collection = this.getCollection(dataObject);
      if (!collection) {
         throw new BackendError("[OKF] Cannot query without a valid collection name");
      }
      const items: DataObjectClass<any>[] = [];

      if (this.dataDir) {
         const baseColPath = path.join(this.dataDir, collection);
         const scanDir = async (dir: string) => {
            try {
               const entries = await fs.readdir(dir, { withFileTypes: true });
               for (const entry of entries) {
                  const fullPath = path.join(dir, entry.name);
                  if (entry.isDirectory()) {
                     await scanDir(fullPath);
                  } else if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.md'))) {
                     if (entry.name === 'index.md' || entry.name === 'log.md') {
                        continue;
                     }
                     const ext = path.extname(entry.name);
                     const content = await fs.readFile(fullPath, 'utf-8');
                     const parsed = this.deserializeContent(content, fullPath);
                     const dao = await dataObject.clone(parsed.data);
                     const itemUid = path.basename(entry.name, ext);
                     dao.uri = new ObjectUri(`${collection}/${itemUid}`);

                     let keep = true;
                     if (filters) {
                        const filterArr = this._flattenFilters(filters);
                        for (const filter of filterArr) {
                           const prop = dao.get(filter.prop);
                           if (typeof prop === 'undefined') {
                              keep = false;
                              break;
                           }
                           if (prop.val() !== filter.value) {
                              keep = false;
                              break;
                           }
                        }
                     }

                     if (keep) {
                        items.push(dao);
                     }
                  }
               }
            } catch (err) {
               // Ignore missing folders
            }
         };
         await scanDir(baseColPath);
      } else if (this.storage) {
         if (typeof (this.storage as any).list === 'function') {
            try {
               const files: string[] = await (this.storage as any).list(collection);
               for (const relPath of files) {
                  const ext = path.extname(relPath);
                  if (ext === '.json' || ext === '.md') {
                     if (path.basename(relPath) === 'index.md' || path.basename(relPath) === 'log.md') {
                        continue;
                     }
                     const stream = await this.storage.getReadable(this.getFile(relPath) as any);
                     const content = await this._streamToString(stream);
                     const parsed = this.deserializeContent(content, relPath);
                     const dao = await dataObject.clone(parsed.data);
                     const itemUid = path.basename(relPath, ext);
                     dao.uri = new ObjectUri(`${collection}/${itemUid}`);

                     let keep = true;
                     if (filters) {
                        const filterArr = this._flattenFilters(filters);
                        for (const filter of filterArr) {
                           const prop = dao.get(filter.prop);
                           if (typeof prop === 'undefined') {
                              keep = false;
                              break;
                           }
                           if (prop.val() !== filter.value) {
                              keep = false;
                              break;
                           }
                        }
                     }

                     if (keep) {
                        items.push(dao);
                     }
                  }
               }
            } catch (err) {
               // Ignore missing folders/files in storage
            }
         }
      }

      // Simple slice implementation for limit/offset
      let slicedItems = items;
      if (pagination && pagination.limits) {
         const offset = pagination.limits.offset || 0;
         const batch = pagination.limits.batch || items.length;
         slicedItems = items.slice(offset, offset + batch);
      }

      return {
         items: slicedItems,
         meta: {
            count: items.length,
            offset: pagination?.limits.offset || 0,
            batch: pagination?.limits.batch || items.length,
            executionTime: Date.now()
         }
      };
   }

    generateCreateSql() { return { upSql: '', downSql: '' }; }
    generateDeltaSql() { return { upSql: [], downSql: [] }; }

    public async rebuildIndices(collection: string): Promise<void> {
       // Don't build indices for telemetry
       if (collection === 'telemetry') return;

       const baseColPath = path.join(this.dataDir, collection);

       const generateForDir = async (dirPath: string): Promise<void> => {
          try {
             const entries = await fs.readdir(dirPath, { withFileTypes: true });
             
             const subdirs: { name: string; description: string }[] = [];
             const concepts: { filename: string; title: string; description: string }[] = [];

             for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                   // Recursively generate indices for subdirectories first
                   await generateForDir(fullPath);
                   
                   // Read description from the subdir's index.md if it exists, or provide a default
                   let desc = `Espace d'accueil pour la catégorie ${entry.name}`;
                   try {
                      const subdirIndexContent = await fs.readFile(path.join(fullPath, 'index.md'), 'utf-8');
                      const lines = subdirIndexContent.split('\n');
                      const descriptionLine = lines.find(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('*'));
                      if (descriptionLine) {
                         desc = descriptionLine.trim();
                      }
                   } catch (e) {
                      // ignore
                   }
                   subdirs.push({ name: entry.name, description: desc });
                } else if (entry.isFile() && entry.name.endsWith('.md')) {
                   if (entry.name === 'index.md' || entry.name === 'log.md') {
                      continue;
                   }
                   
                   // Read concept file to get its title and description/summary
                   try {
                      const docContent = await fs.readFile(fullPath, 'utf-8');
                      const parts = docContent.trim().split('---');
                      if (parts.length >= 3) {
                         const yamlPart = parts[1].trim();
                         const parsed = parseYaml(yamlPart) as any;
                         if (parsed) {
                            const title = parsed.title || entry.name.replace(/\.md$/, '');
                            const desc = parsed.description || parsed.summary || '';
                            concepts.push({ filename: entry.name, title, description: desc });
                         }
                      }
                   } catch (err) {
                      concepts.push({ filename: entry.name, title: entry.name.replace(/\.md$/, ''), description: '' });
                   }
                }
             }

             // Generate index.md body
             let md = `# Index de ${path.basename(dirPath)}\n\n`;
             
             if (subdirs.length > 0) {
                md += `## Sous-catégories\n\n`;
                for (const sub of subdirs) {
                   md += `* [${sub.name}](${sub.name}/) - ${sub.description}\n`;
                }
                md += `\n`;
             }

             if (concepts.length > 0) {
                md += `## Concepts\n\n`;
                for (const con of concepts) {
                   md += `* [${con.title}](${con.filename}) - ${con.description}\n`;
                }
             }

             const indexPath = path.join(dirPath, 'index.md');
             await fs.writeFile(indexPath, md.trim() + '\n', 'utf-8');
             
             if (this.storage) {
                const relativeIndexPath = path.relative(this.dataDir, indexPath);
                const fileType = this.getFile(relativeIndexPath, 'text/markdown');
                await this.storage.create(fileType as any, Readable.from([md.trim() + '\n']));
             }
          } catch (e) {
             Backend.error(`[OKF Indexer] Failed to generate index.md for ${dirPath}: ${(e as Error).message}`);
          }
       };

       await generateForDir(baseColPath);
    }
}
