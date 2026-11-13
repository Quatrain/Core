import {
   InMemoryTenantStore,
   InvalidTenantError,
   NoTenantScopeError,
   NotAMemberError,
   PathTenantResolver,
   Tenancy,
   TenantConflictError,
   TenantNotFoundError,
   TenantScopeConflictError,
   TenantUnavailableError,
   currentScope,
   currentTenant,
   findCurrentScope,
   runInTenant,
   scopeEnvelope,
} from './index'

async function setup() {
   const store = new InMemoryTenantStore()
   const tenancy = new Tenancy({ store, resolver: new PathTenantResolver(), reservedSlugs: ['admin'] })
   const acme = await tenancy.createTenant({ slug: 'acme', name: 'Acme' })
   const globex = await tenancy.createTenant({ slug: 'globex', name: 'Globex' })
   await store.putMembership(acme.id, 'alice', ['reviewer', 'curator', 'reviewer'])
   await store.putMembership(globex.id, 'bob', ['admin'])
   return { store, tenancy, acme, globex }
}

describe('Tenancy scopes', () => {
   it('scopes a request for a member and strips the tenant from the path', async () => {
      const { tenancy, acme } = await setup()
      const scope = await tenancy.scopeForRequest({ path: '/t/acme/documents/12' }, { user: 'alice' })
      expect(scope.tenant.id).toBe(acme.id)
      expect(scope.path).toBe('/documents/12')
      expect(scope.membership?.roles).toEqual(['curator', 'reviewer'])
   })

   it('refuses a user who is a member of another tenant only', async () => {
      const { tenancy } = await setup()
      await expect(tenancy.scopeForRequest({ path: '/t/globex/' }, { user: 'alice' })).rejects.toBeInstanceOf(NotAMemberError)
   })

   it('refuses an unknown tenant and a request naming none', async () => {
      const { tenancy } = await setup()
      await expect(tenancy.scopeForRequest({ path: '/t/initech/x' }, { user: 'alice' })).rejects.toBeInstanceOf(TenantNotFoundError)
      await expect(tenancy.scopeForRequest({ path: '/login' }, { user: 'alice' })).rejects.toBeInstanceOf(TenantNotFoundError)
   })

   it('refuses a suspended tenant, even to a system process', async () => {
      const { tenancy, store, acme } = await setup()
      await store.updateTenant(acme.id, { status: 'suspended' })
      await expect(tenancy.scopeForSlug('acme', { user: 'alice' })).rejects.toBeInstanceOf(TenantUnavailableError)
      await expect(tenancy.scopeForSlug('acme', { system: 'worker' })).rejects.toBeInstanceOf(TenantUnavailableError)
   })

   it('never grants a scope to an absent or ambiguous actor', async () => {
      const { tenancy } = await setup()
      for (const actor of [{ user: '' }, { user: undefined }, {}, { user: 'alice', system: 'worker' }, undefined, null]) {
         await expect(tenancy.scopeForSlug('acme', actor as never)).rejects.toBeInstanceOf(InvalidTenantError)
      }
   })

   it('grants a system process a scope without membership', async () => {
      const { tenancy } = await setup()
      const scope = await tenancy.scopeForSlug('acme', { system: 'worker' })
      expect(scope.membership).toBeUndefined()
      expect(scope.actor).toEqual({ system: 'worker' })
   })

   it('reopens an envelope and checks the membership again', async () => {
      const { tenancy, store, acme } = await setup()
      const scope = await tenancy.scopeForSlug('acme', { user: 'alice' })
      const envelope = JSON.parse(JSON.stringify(tenancy.run(scope, () => scopeEnvelope())))
      expect(envelope).toEqual({ tenant: acme.id, actor: { user: 'alice' } })
      expect((await tenancy.scopeForEnvelope(envelope)).tenant.slug).toBe('acme')
      await store.removeMembership(acme.id, 'alice')
      await expect(tenancy.scopeForEnvelope(envelope)).rejects.toBeInstanceOf(NotAMemberError)
   })
})

describe('tenant context', () => {
   it('exposes the scope to awaited code and nowhere else', async () => {
      const { tenancy } = await setup()
      const scope = await tenancy.scopeForSlug('acme', { user: 'alice' })
      expect(findCurrentScope()).toBeUndefined()
      expect(() => currentTenant()).toThrow(NoTenantScopeError)
      const slug = await tenancy.run(scope, async () => {
         await new Promise((resolve) => setTimeout(resolve, 5))
         return currentTenant().slug
      })
      expect(slug).toBe('acme')
      expect(findCurrentScope()).toBeUndefined()
   })

   it('keeps concurrent scopes apart', async () => {
      const { tenancy } = await setup()
      const acme = await tenancy.scopeForSlug('acme', { system: 'worker' })
      const globex = await tenancy.scopeForSlug('globex', { system: 'worker' })
      const seen = await Promise.all(
         [acme, globex, acme, globex].map((scope, index) =>
            runInTenant(scope, async () => {
               await new Promise((resolve) => setTimeout(resolve, 10 - index * 2))
               return currentScope().tenant.slug
            })
         )
      )
      expect(seen).toEqual(['acme', 'globex', 'acme', 'globex'])
   })

   it('refuses to open another tenant inside a scope', async () => {
      const { tenancy } = await setup()
      const acme = await tenancy.scopeForSlug('acme', { system: 'worker' })
      const globex = await tenancy.scopeForSlug('globex', { system: 'worker' })
      expect(() => runInTenant(acme, () => runInTenant(globex, () => 'leak'))).toThrow(TenantScopeConflictError)
      expect(runInTenant(acme, () => runInTenant(acme, () => currentTenant().slug))).toBe('acme')
   })
})

describe('tenant registry', () => {
   it('rejects reserved, malformed and duplicate slugs', async () => {
      const { tenancy } = await setup()
      await expect(tenancy.createTenant({ slug: 'admin', name: 'Admin' })).rejects.toBeInstanceOf(InvalidTenantError)
      for (const slug of ['Acme', 'a b', '-a', 'a-', '', '../etc', 'a'.repeat(64)]) {
         await expect(tenancy.createTenant({ slug, name: 'X' })).rejects.toBeInstanceOf(InvalidTenantError)
      }
      await expect(tenancy.createTenant({ slug: 'acme', name: 'Other' })).rejects.toBeInstanceOf(TenantConflictError)
   })

   it('updates a tenant and returns copies', async () => {
      const { store, acme } = await setup()
      const updated = await store.updateTenant(acme.id, { settings: { locale: 'en' }, entity: 'entities/42' })
      expect(updated).toMatchObject({ entity: 'entities/42', settings: { locale: 'en' } })
      updated.settings.locale = 'tampered'
      expect((await store.getTenant(acme.id))?.settings).toEqual({ locale: 'en' })
      expect((await store.updateTenant(acme.id, { entity: null })).entity).toBeUndefined()
      await expect(store.updateTenant('missing', { name: 'X' })).rejects.toBeInstanceOf(TenantNotFoundError)
   })

   it('lists memberships by tenant and by user', async () => {
      const { store, acme, globex } = await setup()
      await store.putMembership(globex.id, 'alice', ['reader'])
      expect((await store.listMemberships(globex.id)).map((m) => m.user)).toEqual(['alice', 'bob'])
      expect((await store.listMembershipsOfUser('alice')).map((m) => m.tenant).sort()).toEqual([acme.id, globex.id].sort())
      await expect(store.putMembership('missing', 'alice', [])).rejects.toBeInstanceOf(TenantNotFoundError)
      await expect(store.putMembership(acme.id, 'alice', [''])).rejects.toBeInstanceOf(InvalidTenantError)
      expect(await store.removeMembership(acme.id, 'alice')).toBe(true)
      expect(await store.removeMembership(acme.id, 'alice')).toBe(false)
   })

   it('exports a tenant and imports it on another instance', async () => {
      const { tenancy, acme } = await setup()
      const manifest = JSON.parse(JSON.stringify(await tenancy.exportTenant(acme.id)))
      const targetStore = new InMemoryTenantStore()
      const target = new Tenancy({ store: targetStore })
      const imported = await target.importTenant(manifest)
      expect(imported).toMatchObject({ id: acme.id, slug: 'acme', name: 'Acme' })
      expect((await targetStore.getMembership(acme.id, 'alice'))?.roles).toEqual(['curator', 'reviewer'])
      await expect(target.importTenant(manifest)).rejects.toBeInstanceOf(TenantConflictError)
      await expect(target.importTenant({ ...manifest, format: 'other/9' })).rejects.toBeInstanceOf(InvalidTenantError)
      const foreign = { ...manifest, tenant: { ...manifest.tenant, id: 'x', slug: 'other' } }
      await expect(target.importTenant(foreign)).rejects.toBeInstanceOf(InvalidTenantError)
   })
})
