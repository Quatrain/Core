import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   await adapter.rawQuery(`
      CREATE TABLE IF NOT EXISTS studio_model (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         collectionname TEXT,
         ispersisted INTEGER,
         version REAL DEFAULT 1,
         status TEXT,
         createdby TEXT,
         createdat INTEGER,
         updatedby TEXT,
         updatedat INTEGER,
         deletedby TEXT,
         deletedat INTEGER
      )
   `)
}

export const down = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   await adapter.rawQuery(`DROP TABLE IF EXISTS studio_model`)
}
