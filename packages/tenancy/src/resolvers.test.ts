import { ChainTenantResolver, HeaderTenantResolver, InvalidTenantError, PathTenantResolver, SubdomainTenantResolver } from './index'

describe('PathTenantResolver', () => {
   it('reads the slug after the prefix', () => {
      const resolver = new PathTenantResolver()
      expect(resolver.resolve({ path: '/t/acme/documents' })).toEqual({ slug: 'acme', path: '/documents' })
      expect(resolver.resolve({ path: '/t/acme' })).toEqual({ slug: 'acme', path: '/' })
      expect(resolver.resolve({ path: '/t/acme/' })).toEqual({ slug: 'acme', path: '/' })
   })

   it('ignores other paths and malformed slugs', () => {
      const resolver = new PathTenantResolver()
      for (const path of ['/', '/t', '/t/', '/tx/acme', '/t/Acme/x', '/t/..%2f/x', '/t//acme', '/api/t/acme']) {
         expect(resolver.resolve({ path })).toBeUndefined()
      }
   })

   it('accepts a custom or empty prefix and rejects a malformed one', () => {
      expect(new PathTenantResolver({ prefix: '/org/space' }).resolve({ path: '/org/space/acme/x' })).toEqual({ slug: 'acme', path: '/x' })
      expect(new PathTenantResolver({ prefix: '' }).resolve({ path: '/acme/x' })).toEqual({ slug: 'acme', path: '/x' })
      expect(() => new PathTenantResolver({ prefix: 't/' })).toThrow(InvalidTenantError)
   })
})

describe('SubdomainTenantResolver', () => {
   it('reads the slug before the base domain', () => {
      const resolver = new SubdomainTenantResolver({ baseDomain: 'app.example.org' })
      expect(resolver.resolve({ path: '/x', host: 'Acme.app.example.org:8443' })).toEqual({ slug: 'acme', path: '/x' })
      expect(resolver.resolve({ path: '/x', host: 'app.example.org' })).toBeUndefined()
      expect(resolver.resolve({ path: '/x', host: 'a.b.app.example.org' })).toBeUndefined()
      expect(resolver.resolve({ path: '/x', host: 'acme.app.example.org.evil.test' })).toBeUndefined()
      expect(resolver.resolve({ path: '/x' })).toBeUndefined()
      expect(() => new SubdomainTenantResolver({ baseDomain: ' ' })).toThrow(InvalidTenantError)
   })
})

describe('HeaderTenantResolver and chains', () => {
   it('reads the slug from a header, whatever its case', () => {
      const resolver = new HeaderTenantResolver({ header: 'X-Tenant' })
      expect(resolver.resolve({ path: '/x', headers: { 'x-tenant': 'acme' } })).toEqual({ slug: 'acme', path: '/x' })
      expect(resolver.resolve({ path: '/x', headers: { 'X-TENANT': 'Not Valid' } })).toBeUndefined()
      expect(resolver.resolve({ path: '/x' })).toBeUndefined()
      expect(() => new HeaderTenantResolver({ header: '' })).toThrow(InvalidTenantError)
   })

   it('keeps the first resolver that answers', () => {
      const chain = new ChainTenantResolver([new PathTenantResolver(), new HeaderTenantResolver({ header: 'x-tenant' })])
      expect(chain.resolve({ path: '/t/acme/x', headers: { 'x-tenant': 'globex' } })?.slug).toBe('acme')
      expect(chain.resolve({ path: '/x', headers: { 'x-tenant': 'globex' } })?.slug).toBe('globex')
      expect(chain.resolve({ path: '/x' })).toBeUndefined()
      expect(() => new ChainTenantResolver([])).toThrow(InvalidTenantError)
   })
})
