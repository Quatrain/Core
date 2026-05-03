import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   const tables = [
      `CREATE TABLE IF NOT EXISTS studio_model (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         studioProject TEXT,
         name TEXT NOT NULL,
         collectionName TEXT,
         isPersisted INTEGER,
         version REAL DEFAULT 1,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_property (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         studioModel TEXT NOT NULL,
         name TEXT NOT NULL,
         propertyType TEXT,
         mandatory INTEGER,
         options TEXT,
         ui TEXT,
         version REAL DEFAULT 1,
         "order" INTEGER,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_backend (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT NOT NULL,
         engine TEXT,
         filePath TEXT,
         host TEXT,
         port INTEGER,
         username TEXT,
         password TEXT,
         database TEXT,
         studioProject TEXT,
         credentials TEXT,
         isDefault INTEGER DEFAULT 0,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_history (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT,
         action TEXT NOT NULL,
         entityType TEXT NOT NULL,
         entity TEXT NOT NULL,
         entityName TEXT,
         user TEXT,
         details TEXT,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_target (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT NOT NULL,
         targetType TEXT NOT NULL,
         options TEXT,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_deployment (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT,
         studioModel TEXT NOT NULL,
         studioBackend TEXT NOT NULL,
         version INTEGER NOT NULL,
         migrationSql TEXT,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_environment (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT NOT NULL,
         studioProject TEXT,
         environment TEXT DEFAULT 'development',
         studioBackend TEXT,
         studioStorage TEXT,
         studioAuth TEXT,
         studioTarget TEXT,
         backendStudioSecret TEXT,
         storageStudioSecret TEXT,
         authStudioSecret TEXT,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_secret (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT NOT NULL,
         "values" TEXT,
         studioEnvironment TEXT NOT NULL,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_project (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT NOT NULL,
         description TEXT,
         authMode TEXT DEFAULT 'none',
         recipe TEXT,
         defaultLanguage TEXT DEFAULT 'en',
         languages TEXT DEFAULT '["en", "fr"]',
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_widget (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT NOT NULL,
         widgetType TEXT,
         studioModel TEXT,
         layout TEXT,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_view (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT NOT NULL,
         route TEXT,
         layout TEXT,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_storage (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT NOT NULL,
         provider TEXT,
         options TEXT,
         isDefault INTEGER DEFAULT 0,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS studio_auth (
         id TEXT PRIMARY KEY,
         uid TEXT UNIQUE,
         name TEXT NOT NULL,
         provider TEXT,
         options TEXT,
         isDefault INTEGER DEFAULT 0,
         status TEXT,
         createdBy TEXT,
         createdAt INTEGER,
         updatedBy TEXT,
         updatedAt INTEGER,
         deletedBy TEXT,
         deletedAt INTEGER
      )`
   ]

   for (const query of tables) {
      await adapter.rawQuery(query)
   }

   const defaultTargetId = 'default-target-docker'
   const now = new Date().getTime()
   const insertQuery = `INSERT INTO studio_target (id, uid, name, targetType, status, createdAt) 
      VALUES ('${defaultTargetId}', '${defaultTargetId}', 'Docker Local', 'docker-compose', 'created', ${now}) 
      ON CONFLICT(uid) DO NOTHING`
   await adapter.rawQuery(insertQuery)
}

export const down = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   const tables = [
      'studio_model',
      'studio_property',
      'studio_backend',
      'studio_deployment',
      'studio_environment',
      'studio_secret',
      'studio_project',
      'studio_widget',
      'studio_view',
      'studio_storage',
      'studio_auth'
   ]

   for (const table of tables) {
      await adapter.rawQuery(`DROP TABLE IF EXISTS ${table}`)
   }
}
