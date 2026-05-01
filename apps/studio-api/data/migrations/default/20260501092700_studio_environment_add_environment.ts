import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   // SQLite ADD COLUMN doesn't fail if the column already exists, but it's good practice to wrap in a try-catch
   try {
      await adapter.rawQuery(`ALTER TABLE studio_environment ADD COLUMN environment TEXT DEFAULT 'development'`)
   } catch (e: any) {
      // Ignore if column already exists
      if (!e.message.includes('duplicate column name')) {
         throw e
      }
   }
}

export const down = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   // SQLite does not support DROP COLUMN until newer versions, and Quatrain handles this by ignoring down in some cases.
   // So we'll just ignore for now.
}
