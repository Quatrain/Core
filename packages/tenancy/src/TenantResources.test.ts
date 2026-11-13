import { InMemoryTenantStore, InvalidTenantError, NoTenantScopeError, TenantResources, runInTenant, type TenantInterface } from './index'

async function tenants() {
   const store = new InMemoryTenantStore()
   const acme = await store.createTenant({ slug: 'acme', name: 'Acme', settings: { bucket: 'acme-files' } })
   const globex = await store.createTenant({ slug: 'globex', name: 'Globex', settings: { bucket: 'globex-files' } })
   return { store, acme, globex }
}

describe('TenantResources', () => {
   it('builds one resource per tenant, once, and serves the open scope', async () => {
      const { acme, globex } = await tenants()
      const built: string[] = []
      const resources = new TenantResources()
      const storage = resources.define('storage', {
         create: async (tenant: TenantInterface) => {
            built.push(tenant.slug)
            await new Promise((resolve) => setTimeout(resolve, 5))
            return { bucket: tenant.settings.bucket as string }
         },
      })
      const [first, second] = await Promise.all([storage.get(acme), storage.get(acme)])
      expect(first).toBe(second)
      expect(await storage.get(globex)).toEqual({ bucket: 'globex-files' })
      expect(built).toEqual(['acme', 'globex'])
      expect(await runInTenant({ tenant: acme, actor: { system: 'test' } }, () => storage.get())).toBe(first)
      await expect((async () => storage.get())()).rejects.toBeInstanceOf(NoTenantScopeError)
   })

   it('rebuilds and disposes when the tenant settings change', async () => {
      const { store, acme } = await tenants()
      const disposed: string[] = []
      const resources = new TenantResources()
      const storage = resources.define('storage', {
         create: (tenant: TenantInterface) => ({ bucket: tenant.settings.bucket as string }),
         dispose: (resource) => {
            disposed.push(resource.bucket)
         },
      })
      const before = await storage.get(acme)
      const changed = await store.updateTenant(acme.id, { settings: { bucket: 'acme-new' } })
      expect(await storage.get(changed)).toEqual({ bucket: 'acme-new' })
      expect(disposed).toEqual(['acme-files'])
      expect(await storage.get(changed)).not.toBe(before)
   })

   it('keeps the resource when nothing it is built from changed', async () => {
      const { store, acme } = await tenants()
      let built = 0
      const resources = new TenantResources()
      const whole = resources.define('whole', { create: () => ++built })
      const byBucket = resources.define('by-bucket', { create: () => ++built, fingerprint: (tenant) => tenant.settings.bucket })

      await whole.get(acme)
      await byBucket.get(acme)
      expect(built).toBe(2)

      const renamed = await store.updateTenant(acme.id, { name: 'Acme Ltd' })
      await whole.get(renamed)
      await byBucket.get(renamed)
      expect(built).toBe(2)

      const reordered = { ...renamed, settings: { locale: 'en', bucket: 'acme-files' } }
      await whole.get({ ...renamed, settings: { bucket: 'acme-files', locale: 'en' } })
      await whole.get(reordered)
      await byBucket.get(reordered)
      expect(built).toBe(3)
   })

   it('does not keep a failed build', async () => {
      const { acme } = await tenants()
      let attempts = 0
      const resources = new TenantResources()
      const flaky = resources.define('flaky', {
         create: () => {
            attempts += 1
            if (attempts === 1) {
               throw new Error('unreachable')
            }
            return 'ready'
         },
      })
      await expect(flaky.get(acme)).rejects.toThrow('unreachable')
      expect(await flaky.get(acme)).toBe('ready')
   })

   it('evicts one tenant, clears all, and rejects duplicate names', async () => {
      const { acme, globex } = await tenants()
      const disposed: string[] = []
      const resources = new TenantResources()
      const storage = resources.define('storage', { create: (tenant: TenantInterface) => tenant.slug, dispose: (slug) => void disposed.push(slug) })
      await storage.get(acme)
      await storage.get(globex)
      await resources.evict(acme.id)
      expect(disposed).toEqual(['acme'])
      await storage.get(acme)
      await resources.clear()
      expect(disposed.sort()).toEqual(['acme', 'acme', 'globex'])
      expect(() => resources.define('storage', { create: () => 1 })).toThrow(InvalidTenantError)
   })
})
