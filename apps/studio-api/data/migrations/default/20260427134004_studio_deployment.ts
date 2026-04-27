import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   await adapter.rawQuery(`
      CREATE TABLE IF NOT EXISTS studio_deployment (
         id TEXT PRIMARY KEY,
         modelid TEXT NOT NULL,
         backendid TEXT NOT NULL,
         version INTEGER NOT NULL,
         migrationsql TEXT,
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
   await adapter.rawQuery(`DROP TABLE IF EXISTS studio_deployment`)
}
