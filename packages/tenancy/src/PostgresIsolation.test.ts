import { Limits, PersistedBaseObject, SortAndLimit, Sorting, User } from '@quatrain/backend'
import { PostgresAdapter, assertRowSecurityRole, rowIsolationSql } from '@quatrain/backend-postgres'
import { BaseObjectProperties, Core, StringProperty } from '@quatrain/core'
import { NotAMemberError, Tenancy, TenancyRepository, currentTenant, findCurrentScope } from './index'

/**
 * End-to-end check of the recommended PostgreSQL set-up: registry and data in one database, the
 * application connected with a restricted role, rows isolated per tenant.
 * Needs a database reached as a superuser and is skipped without one:
 *   POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5432 POSTGRES_DB=quatrain_test POSTGRES_USER=postgres yarn jest packages/tenancy
 */
const suite = process.env.POSTGRES_HOST ? describe : describe.skip

// Every model refers to users (createdBy…): with the class registered, the adapter creates the
// complete users table instead of a bare placeholder that would break other tests.
Core.addClass('User', User)

class Document extends PersistedBaseObject {
   static COLLECTION = 'tenancy_test_documents'
   static PROPS_DEFINITION = [
      ...BaseObjectProperties,
      { name: 'tenant', type: StringProperty.TYPE },
      { name: 'title', type: StringProperty.TYPE },
   ]
}

const APP_ROLE = 'tenancy_test_app'
const TABLES = ['tenancy_test_documents', 'tenant_memberships', 'tenants']

suite('tenancy with PostgreSQL row isolation', () => {
   const connection = {
      host: process.env.POSTGRES_HOST,
      port: Number.parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'quatrain_test',
   }
   let owner: PostgresAdapter
   let app: PostgresAdapter
   let tenancy: Tenancy

   const document = (title: string) => Document.fromObject({ name: title, tenant: currentTenant().id, title } as never).dataObject
   const titles = async () => {
      const template = (await Document.factory()).dataObject
      const result = await app.find(template, [], new SortAndLimit([new Sorting('title')], new Limits(0, 50)), undefined)
      return result.items.map((item: any) => item.val('title'))
   }
   const dropTables = async () => {
      for (const table of TABLES) {
         await owner.rawQuery(`DROP TABLE IF EXISTS ${table}`)
      }
   }

   beforeAll(async () => {
      owner = new PostgresAdapter({
         config: { ...connection, user: process.env.POSTGRES_USER || 'postgres', password: process.env.POSTGRES_PASSWORD || 'password', max: 2 },
      })
      await dropTables()

      // Migration time, owner role: registry, data tables, policies, grants.
      const registry = new TenancyRepository(owner)
      const acme = await registry.createTenant({ slug: 'acme', name: 'Acme' })
      const globex = await registry.createTenant({ slug: 'globex', name: 'Globex' })
      await registry.putMembership(acme.id, 'alice', ['curator'])
      await registry.putMembership(globex.id, 'bob', ['curator'])
      await owner.create(Document.fromObject({ name: 'seed', tenant: 'seed', title: 'seed' } as never).dataObject, undefined)
      await owner.rawQuery('DELETE FROM tenancy_test_documents')
      await owner.rawQuery(rowIsolationSql('tenancy_test_documents'))
      await owner.rawQuery(`DO $$ BEGIN CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_ROLE}'; EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
      await owner.rawQuery(`GRANT SELECT, INSERT, UPDATE, DELETE ON tenancy_test_documents TO ${APP_ROLE}`)
      await owner.rawQuery(`GRANT SELECT ON tenants, tenant_memberships, "user" TO ${APP_ROLE}`)

      // Run time, restricted role: the tenant of the open scope becomes the session setting.
      app = new PostgresAdapter({
         config: {
            ...connection,
            user: APP_ROLE,
            password: APP_ROLE,
            max: 4,
            sessionSettings: () => {
               const scope = findCurrentScope()
               return scope ? { 'app.tenant': scope.tenant.id } : undefined
            },
         },
      })
      tenancy = new Tenancy({ store: new TenancyRepository(app) })
   })

   afterAll(async () => {
      await app?.disconnect()
      await dropTables()
      await owner.rawQuery(`REVOKE ALL ON "user" FROM ${APP_ROLE}`)
      await owner.rawQuery(`DROP ROLE IF EXISTS ${APP_ROLE}`)
      await owner.disconnect()
   })

   it('runs with a role subject to row-level security', async () => {
      await expect(assertRowSecurityRole(app)).resolves.toBeUndefined()
   })

   it('reads the registry with the restricted role and checks memberships', async () => {
      expect((await tenancy.scopeForSlug('acme', { user: 'alice' })).membership?.roles).toEqual(['curator'])
      await expect(tenancy.scopeForSlug('globex', { user: 'alice' })).rejects.toBeInstanceOf(NotAMemberError)
   })

   it('gives each tenant its own documents through the ordinary adapter calls', async () => {
      const acme = await tenancy.scopeForSlug('acme', { user: 'alice' })
      const globex = await tenancy.scopeForSlug('globex', { user: 'bob' })

      await tenancy.run(acme, async () => {
         await app.create(document('acme-guide'), undefined)
         await app.create(document('acme-notes'), undefined)
      })
      await tenancy.run(globex, () => app.create(document('globex-plan'), undefined))

      expect(await tenancy.run(acme, titles)).toEqual(['acme-guide', 'acme-notes'])
      expect(await tenancy.run(globex, titles)).toEqual(['globex-plan'])
      expect(await titles()).toEqual([])

      const interleaved = await Promise.all([acme, globex, acme, globex].map((scope) => tenancy.run(scope, titles)))
      expect(interleaved).toEqual([['acme-guide', 'acme-notes'], ['globex-plan'], ['acme-guide', 'acme-notes'], ['globex-plan']])
   })

   it('refuses a document written for another tenant', async () => {
      const acme = await tenancy.scopeForSlug('acme', { user: 'alice' })
      const globex = await tenancy.scopeForSlug('globex', { user: 'bob' })
      const forged = Document.fromObject({ name: 'forged', tenant: globex.tenant.id, title: 'forged' } as never).dataObject
      await expect(tenancy.run(acme, () => app.create(forged, undefined))).rejects.toThrow()
      expect(await tenancy.run(globex, titles)).toEqual(['globex-plan'])
   })

   it('cannot alter the registry with the restricted role', async () => {
      await expect(new TenancyRepository(app).createTenant({ slug: 'rogue', name: 'Rogue' })).rejects.toThrow()
      expect((await new TenancyRepository(owner).listTenants()).map((tenant) => tenant.slug)).toEqual(['acme', 'globex'])
   })
})
