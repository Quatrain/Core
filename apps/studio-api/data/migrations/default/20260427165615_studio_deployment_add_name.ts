import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   await adapter.rawQuery(`ALTER TABLE studio_deployment ADD COLUMN name TEXT;`)
}

export const down = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   // SQLite does not easily support dropping a column, so we ignore down for this simple add.
}
