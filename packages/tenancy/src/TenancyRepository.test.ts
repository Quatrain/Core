import { SQLiteAdapter } from '@quatrain/backend-sqlite'
import { InvalidTenantError, Tenancy, TenancyRepository, TenantConflictError, TenantNotFoundError } from './index'

/**
 * The repository is exercised on an in-memory SQLite database: a real adapter, which enforces
 * unique properties, without any server to run.
 */
const backend = new SQLiteAdapter({ config: { database: ':memory:' } })
const store = new TenancyRepository(backend)

afterAll(async () => {
   await backend.close()
})

describe('TenancyRepository', () => {
   let acmeId: string
   let globexId: string

   it('creates tenants and finds them by identifier and slug', async () => {
      const acme = await store.createTenant({ slug: 'acme', name: ' Acme ', settings: { bucket: 'acme-files' } })
      const globex = await store.createTenant({ slug: 'globex', name: 'Globex', status: 'suspended', entity: 'entities/42' })
      acmeId = acme.id
      globexId = globex.id

      expect(acme).toMatchObject({ slug: 'acme', name: 'Acme', status: 'active', settings: { bucket: 'acme-files' } })
      expect(acme.entity).toBeUndefined()
      expect(globex).toMatchObject({ status: 'suspended', entity: 'entities/42', settings: {} })
      expect(await store.getTenant(acmeId)).toMatchObject({ id: acmeId, slug: 'acme', settings: { bucket: 'acme-files' } })
      expect((await store.findTenantBySlug('globex'))?.id).toBe(globexId)
      expect(await store.findTenantBySlug('initech')).toBeUndefined()
      expect(await store.getTenant('missing')).toBeUndefined()
      expect(await store.getTenant('tenants/../x')).toBeUndefined()
      expect((await store.listTenants()).map((tenant) => tenant.slug)).toEqual(['acme', 'globex'])
   })

   it('refuses a slug or an identifier already taken, and malformed values', async () => {
      await expect(store.createTenant({ slug: 'acme', name: 'Other' })).rejects.toBeInstanceOf(TenantConflictError)
      await expect(store.createTenant({ slug: 'other', name: 'Other', id: acmeId })).rejects.toBeInstanceOf(TenantConflictError)
      await expect(store.createTenant({ slug: 'Bad Slug', name: 'X' })).rejects.toBeInstanceOf(InvalidTenantError)
      expect((await store.listTenants()).map((tenant) => tenant.slug)).toEqual(['acme', 'globex'])
   })

   it('treats a slug holding SQL as a plain value', async () => {
      expect(await store.findTenantBySlug("acme' OR '1'='1")).toBeUndefined()
   })

   it('updates a tenant', async () => {
      const updated = await store.updateTenant(globexId, { name: ' Globex Ltd ', status: 'active', settings: { locale: 'en' } })
      expect(updated).toMatchObject({ id: globexId, slug: 'globex', name: 'Globex Ltd', status: 'active', entity: 'entities/42', settings: { locale: 'en' } })
      expect((await store.updateTenant(globexId, { entity: null })).entity).toBeUndefined()
      expect(await store.getTenant(globexId)).toMatchObject({ name: 'Globex Ltd', status: 'active', settings: { locale: 'en' } })
      await expect(store.updateTenant('missing', { name: 'X' })).rejects.toBeInstanceOf(TenantNotFoundError)
   })

   it('records one membership per user and tenant', async () => {
      expect(await store.putMembership(acmeId, 'alice', ['reviewer', 'curator', 'reviewer'])).toMatchObject({ tenant: acmeId, user: 'alice', roles: ['curator', 'reviewer'] })
      expect((await store.putMembership(acmeId, 'alice', ['admin'])).roles).toEqual(['admin'])
      await store.putMembership(globexId, 'alice', [])
      await store.putMembership(globexId, "o'brien|idp", ['reader'])

      expect((await store.listMemberships(acmeId)).map((membership) => membership.user)).toEqual(['alice'])
      expect((await store.listMemberships(globexId)).map((membership) => membership.user)).toEqual(['alice', "o'brien|idp"])
      expect((await store.listMembershipsOfUser('alice')).map((membership) => membership.tenant).sort()).toEqual([acmeId, globexId].sort())
      expect((await store.getMembership(globexId, "o'brien|idp"))?.roles).toEqual(['reader'])
      expect(await store.getMembership(acmeId, "o'brien|idp")).toBeUndefined()

      await expect(store.putMembership('missing', 'alice', [])).rejects.toBeInstanceOf(TenantNotFoundError)
      await expect(store.putMembership(acmeId, '', [])).rejects.toBeInstanceOf(InvalidTenantError)
   })

   it('keeps one membership when the same one is written concurrently', async () => {
      await Promise.all(Array.from({ length: 6 }, (_, index) => store.putMembership(acmeId, 'carol', [`role-${index}`])))
      expect((await store.listMemberships(acmeId)).filter((membership) => membership.user === 'carol')).toHaveLength(1)
   })

   it('removes a membership', async () => {
      expect(await store.removeMembership(globexId, "o'brien|idp")).toBe(true)
      expect(await store.removeMembership(globexId, "o'brien|idp")).toBe(false)
      expect(await store.getMembership(globexId, "o'brien|idp")).toBeUndefined()
   })

   it('feeds Tenancy: scopes, export and import', async () => {
      const tenancy = new Tenancy({ store })
      expect((await tenancy.scopeForSlug('acme', { user: 'alice' })).membership?.roles).toEqual(['admin'])
      await expect(tenancy.scopeForSlug('acme', { user: 'bob' })).rejects.toThrow('not a member')

      const manifest = JSON.parse(JSON.stringify(await tenancy.exportTenant(acmeId)))
      const otherBackend = new SQLiteAdapter({ config: { database: ':memory:' } })
      const otherStore = new TenancyRepository(otherBackend)
      const imported = await new Tenancy({ store: otherStore }).importTenant(manifest)
      expect(imported).toMatchObject({ id: acmeId, slug: 'acme', settings: { bucket: 'acme-files' } })
      expect((await otherStore.getMembership(acmeId, 'alice'))?.roles).toEqual(['admin'])
      await otherBackend.close()
   })
})
