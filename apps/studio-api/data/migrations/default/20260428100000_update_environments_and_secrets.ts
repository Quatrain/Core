import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   // Add new columns to studio_environment
   try { await adapter.rawQuery(`ALTER TABLE studio_environment ADD COLUMN backendsecretid TEXT;`) } catch (e) { /* ignore if exists */ }
   try { await adapter.rawQuery(`ALTER TABLE studio_environment ADD COLUMN storagesecretid TEXT;`) } catch (e) { /* ignore if exists */ }
   try { await adapter.rawQuery(`ALTER TABLE studio_environment ADD COLUMN authsecretid TEXT;`) } catch (e) { /* ignore if exists */ }

   // Add new values column to studio_secret (replacing value)
   try { await adapter.rawQuery(`ALTER TABLE studio_secret ADD COLUMN "values" TEXT;`) } catch (e) { /* ignore if exists */ }
}

export const down = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   // SQLite does not easily support dropping a column, so we ignore down for this simple add.
}
