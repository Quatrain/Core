import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   await adapter.rawQuery(`
      CREATE TABLE IF NOT EXISTS studio_property (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         modelid TEXT NOT NULL,
         propertytype TEXT NOT NULL,
         mandatory INTEGER,
         options TEXT,
         version REAL DEFAULT 1,
         "order" INTEGER DEFAULT 0,
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
   await adapter.rawQuery(`DROP TABLE IF EXISTS studio_property`)
}
