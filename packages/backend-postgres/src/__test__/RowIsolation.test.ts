import { AsyncLocalStorage } from 'node:async_hooks'
import { BackendError, Filter, Limits, PersistedBaseObject, SortAndLimit, Sorting } from '@quatrain/backend'
import { BaseObjectProperties, NotFoundError, StringProperty } from '@quatrain/core'
import { PostgresAdapter } from '../PostgresAdapter'
import { assertRowSecurityRole, rowIsolationSql } from '../rowIsolation'

class Note extends PersistedBaseObject {
   static COLLECTION = 'isolated_notes'
   static PROPS_DEFINITION = [
      ...BaseObjectProperties,
      { name: 'tenant', type: StringProperty.TYPE },
      { name: 'title', type: StringProperty.TYPE },
   ]
}

const APP_ROLE = 'row_isolation_test_app'
const connection = {
   host: process.env.POSTGRES_HOST || 'localhost',
   port: Number.parseInt(process.env.POSTGRES_PORT || '5432'),
   database: process.env.POSTGRES_DB || 'quatrain_test',
}

/** Owner of the running unit of work, as a host application would keep it. */
const currentTenant = new AsyncLocalStorage<string>()

const admin = new PostgresAdapter({
   config: { ...connection, user: process.env.POSTGRES_USER || 'postgres', password: process.env.POSTGRES_PASSWORD || 'password', max: 2 },
})
const app = new PostgresAdapter({
   config: {
      ...connection,
      user: APP_ROLE,
      password: APP_ROLE,
      max: 4,
      sessionSettings: () => {
         const tenant = currentTenant.getStore()
         return tenant === undefined ? undefined : { 'app.tenant': tenant }
      },
   },
})

const as = <T>(tenant: string, work: () => Promise<T>): Promise<T> => currentTenant.run(tenant, work)
const note = (tenant: string, title: string) => Note.fromObject({ name: title, tenant, title } as never).dataObject
const titles = async () => {
   const template = Note.fromObject({ name: 'template' } as never).dataObject
   const result = await app.find(template, [], new SortAndLimit([new Sorting('title')], new Limits(0, 50)))
   return result.items.map((item: any) => item.val('title'))
}
const stored = async () => (await admin.rawQuery('SELECT title FROM isolated_notes ORDER BY title')).rows.map((row: any) => row.title)

let acmeNote: any

beforeAll(async () => {
   await admin.rawQuery('DROP TABLE IF EXISTS isolated_notes')
   // The owner role creates the table and the tables it refers to (base properties point to users):
   // the restricted role cannot create anything.
   await admin.create(note('seed', 'seed'), undefined)
   await admin.rawQuery('DELETE FROM isolated_notes')
   await admin.rawQuery(rowIsolationSql('isolated_notes'))
   await admin.rawQuery(`DO $$ BEGIN CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_ROLE}'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
   await admin.rawQuery(`GRANT SELECT, INSERT, UPDATE, DELETE ON isolated_notes TO ${APP_ROLE}`)
   await admin.rawQuery(`GRANT SELECT ON "user" TO ${APP_ROLE}`)
   acmeNote = await as('acme', () => app.create(note('acme', 'acme-1'), undefined))
   await as('acme', () => app.create(note('acme', 'acme-2'), undefined))
   await as('globex', () => app.create(note('globex', 'globex-1'), undefined))
})

afterAll(async () => {
   await app.disconnect()
   await admin.rawQuery('DROP TABLE IF EXISTS isolated_notes')
   await admin.rawQuery(`REVOKE ALL ON "user" FROM ${APP_ROLE}`)
   await admin.rawQuery(`DROP ROLE IF EXISTS ${APP_ROLE}`)
   await admin.disconnect()
})

describe('rowIsolationSql', () => {
   test('builds idempotent row-level-security statements', () => {
      const sql = rowIsolationSql('documents')
      expect(sql).toContain('ALTER TABLE documents FORCE ROW LEVEL SECURITY;')
      expect(sql).toContain(`USING (tenant = nullif(current_setting('app.tenant', true), ''))`)
      expect(rowIsolationSql('notes', { schema: 'app', column: 'owner', setting: 'acl.owner', policy: 'by_owner' })).toContain(
         `CREATE POLICY by_owner ON app.notes USING (owner = nullif(current_setting('acl.owner', true), ''))`
      )
   })

   test('refuses anything but plain identifiers', () => {
      for (const table of ['Documents', 'documents; DROP TABLE x', '"documents"', '', '1abc']) {
         expect(() => rowIsolationSql(table)).toThrow(BackendError)
      }
      expect(() => rowIsolationSql('documents', { column: 'tenant) OR (true' })).toThrow(BackendError)
      expect(() => rowIsolationSql('documents', { setting: "x', true) OR true --" })).toThrow(BackendError)
   })
})

describe('Postgres row isolation through the adapter', () => {
   test('accepts the application role and rejects a superuser', async () => {
      await expect(assertRowSecurityRole(app)).resolves.toBeUndefined()
      await expect(assertRowSecurityRole(admin)).rejects.toBeInstanceOf(BackendError)
   })

   test('find() returns the rows of the current owner only', async () => {
      expect(await as('acme', titles)).toEqual(['acme-1', 'acme-2'])
      expect(await as('globex', titles)).toEqual(['globex-1'])
      const filtered = await as('globex', () => app.find(note('x', 'x'), [new Filter('title', 'acme-1')]))
      expect(filtered.items).toHaveLength(0)
   })

   test('without an owner nothing is visible and nothing can be written', async () => {
      expect(await titles()).toEqual([])
      await expect(app.create(note('acme', 'stray'), undefined)).rejects.toBeInstanceOf(BackendError)
      expect(await stored()).toEqual(['acme-1', 'acme-2', 'globex-1'])
   })

   test('a record of another owner cannot be read, forged, updated or deleted', async () => {
      // An object already filled is not filled again by read(): start from an empty one.
      const foreign = async () => {
         const target = (await Note.factory()).dataObject
         target.uri.path = acmeNote.path
         return target
      }
      await expect(as('globex', async () => app.read(await foreign()))).rejects.toBeInstanceOf(NotFoundError)
      await expect(as('globex', () => app.create(note('acme', 'forged'), undefined))).rejects.toBeInstanceOf(BackendError)

      const hijack = await foreign()
      hijack.set('title', 'hijacked')
      await as('globex', () => app.update(hijack))
      await as('globex', async () => app.delete(await foreign(), true))
      expect(await stored()).toEqual(['acme-1', 'acme-2', 'globex-1'])

      expect((await as('acme', async () => app.read(await foreign()))).val('title')).toBe('acme-1')
   })

   test('concurrent owners stay apart and the pool keeps no owner', async () => {
      const seen = await Promise.all(['acme', 'globex', 'acme', 'globex', 'acme', 'globex', 'acme', 'globex'].map((tenant) => as(tenant, titles)))
      expect(seen).toEqual(Array.from({ length: 4 }, () => [['acme-1', 'acme-2'], ['globex-1']]).flat())
      expect(await titles()).toEqual([])
      expect((await app.rawQuery(`SELECT current_setting('app.tenant', true) AS t`)).rows[0].t ?? '').toBe('')
   })

   test('refuses a malformed setting name', async () => {
      const broken = new PostgresAdapter({ config: { ...connection, user: APP_ROLE, password: APP_ROLE, sessionSettings: () => ({ 'tenant; DROP': 'x' }) } })
      await expect(broken.rawQuery('SELECT 1')).rejects.toBeInstanceOf(BackendError)
      await broken.disconnect()
   })
})
