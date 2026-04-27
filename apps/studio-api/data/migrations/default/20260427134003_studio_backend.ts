import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   await adapter.rawQuery(`
      CREATE TABLE IF NOT EXISTS studio_backend (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         engine TEXT NOT NULL,
         filepath TEXT,
         host TEXT,
         port INTEGER,
         username TEXT,
         password TEXT,
         database TEXT,
         isdefault INTEGER DEFAULT 0,
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
   await adapter.rawQuery(`DROP TABLE IF EXISTS studio_backend`)
}
