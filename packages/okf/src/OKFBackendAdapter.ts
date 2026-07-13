import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { 
   AbstractBackendAdapter, 
   BackendParameters, 
   DataObjectClass,
   QueryResultType,
   Filters,
   Filter,
   SortAndLimit,
   BackendError
} from '@quatrain/backend';
import { ObjectUri, NotFoundError } from '@quatrain/core';

/**
 * File-based persistence adapter conforming to the Open Knowledge Format (OKF) standard.
 * Serializes entities into flat directory layouts.
 */
export class OKFBackendAdapter extends AbstractBackendAdapter {
   protected dataDir: string;

   /**
    * Instantiates the OKF storage adapter.
    * 
    * @param params - Configuration parameters containing database path and optional settings.
    */
   constructor(params?: BackendParameters) {
      const actualParams = params || {};
      super(actualParams);
      this.dataDir = (actualParams.config?.database as string) || process.env.STUDIO_DATA_DIR || '/data/okf';
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

      return path.join(collection, `${uid}.json`);
   }

   /**
    * Creates a new JSON document on disk matching the OKF structure.
    * 
    * @param dao - The payload object.
    * @param desiredUid - Optional custom UID.
    * @returns The hydrated DataObject.
    */
   async create(dao: DataObjectClass<any>, desiredUid?: string): Promise<DataObjectClass<any>> {
      const uid: string = desiredUid || (dao.val('id') as string) || crypto.randomUUID();
      const relativePath = this.getOKFPath(dao, uid);
      const fullPath = path.join(this.dataDir, relativePath);

      const payload = {
         meta: {
            version: '1.0',
            created_by: dao.val('createdBy') || 'operator@sodav.ci',
            created_at: dao.val('createdAt') || new Date().toISOString()
         },
         data: dao.toJSON()
      };

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, JSON.stringify(payload, null, 2), 'utf-8');

      dao.uri = new ObjectUri(`${this.getCollection(dao)}/${uid}`);
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
      const relativePath = this.getOKFPath(dao, uid);
      const fullPath = path.join(this.dataDir, relativePath);

      try {
         const raw = await fs.readFile(fullPath, 'utf-8');
         const parsed = JSON.parse(raw);
         return await dao.populate(parsed.data);
      } catch (err) {
         throw new NotFoundError(`[OKF] Record not found at path: ${relativePath}`);
      }
   }

   /**
    * Overwrites the JSON document with the updated payload.
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

      const payload = {
         meta: {
            version: '1.0',
            created_by: dao.val('createdBy') || 'operator@sodav.ci',
            created_at: dao.val('createdAt') || new Date().toISOString()
         },
         data: dao.toJSON()
      };

      await fs.writeFile(fullPath, JSON.stringify(payload, null, 2), 'utf-8');
      return dao;
   }

   /**
    * Deletes the JSON file from the filesystem.
    * 
    * @param dao - The target DataObject to remove.
    * @returns The cleared DataObject.
    */
   async delete(dao: DataObjectClass<any>): Promise<DataObjectClass<any>> {
      const uid = dao.uri.uid;
      if (!uid) {
         throw new BackendError("[OKF] Cannot delete record without a valid UID");
      }
      const relativePath = this.getOKFPath(dao, uid);
      const fullPath = path.join(this.dataDir, relativePath);

      try {
         await fs.unlink(fullPath);
      } catch (err) {
         throw new NotFoundError(`[OKF] Failed to delete record at path: ${relativePath}`);
      }

      return dao;
   }

   /**
    * Recursively removes the directory associated with a collection.
    * 
    * @param collection - The collection folder path to clear.
    */
   async deleteCollection(collection: string): Promise<void> {
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
      const baseColPath = path.join(this.dataDir, collection);
      
      const scanDir = async (dir: string) => {
         try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
               const fullPath = path.join(dir, entry.name);
               if (entry.isDirectory()) {
                  await scanDir(fullPath);
               } else if (entry.isFile() && entry.name.endsWith('.json')) {
                  const content = await fs.readFile(fullPath, 'utf-8');
                  const parsed = JSON.parse(content);
                  const dao = await dataObject.clone(parsed.data);
                  
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
}
