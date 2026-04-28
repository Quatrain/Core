import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   try { await adapter.rawQuery(`ALTER TABLE studio_project ADD COLUMN recipe TEXT;`) } catch (e) { /* ignore if exists */ }
}

export const down = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   // SQLite does not easily support dropping a column
}
