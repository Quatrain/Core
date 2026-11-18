import { InvalidTenantError } from './errors'
import type { TenantCandidateInterface, TenantRequestInterface, TenantResolverInterface } from './types'
import { isSlug } from '@quatrain/identifiers'

/**
 * Reads the tenant from the first path segments: `/t/<slug>/…` with the default prefix.
 */
export class PathTenantResolver implements TenantResolverInterface {
   protected readonly prefix: string

   /**
    * @param options - `prefix`: path placed before the slug, `/t` by default; `''` puts the slug first.
    * @throws InvalidTenantError when the prefix is not empty and not a clean absolute path.
    */
   constructor(options: { prefix?: string } = {}) {
      const prefix = options.prefix ?? '/t'
      if (prefix !== '' && !/^(?:\/[A-Za-z0-9._~-]+)+$/.test(prefix)) {
         throw new InvalidTenantError('PathTenantResolver: "prefix" must be empty or an absolute path without trailing slash.')
      }
      this.prefix = prefix
   }

   /** @inheritdoc */
   resolve(request: TenantRequestInterface): TenantCandidateInterface | undefined {
      const path = request.path
      if (typeof path !== 'string' || !path.startsWith(`${this.prefix}/`)) {
         return undefined
      }
      const rest = path.slice(this.prefix.length + 1)
      const cut = rest.indexOf('/')
      const slug = cut === -1 ? rest : rest.slice(0, cut)
      if (!isSlug(slug)) {
         return undefined
      }
      return { slug, path: cut === -1 ? '/' : rest.slice(cut) }
   }
}

/**
 * Reads the tenant from the host name: `<slug>.<baseDomain>`.
 */
export class SubdomainTenantResolver implements TenantResolverInterface {
   protected readonly suffix: string

   /**
    * @param options - `baseDomain`: domain shared by every tenant, for instance `app.example.org`.
    * @throws InvalidTenantError when the base domain is missing.
    */
   constructor(options: { baseDomain: string }) {
      const baseDomain = (options?.baseDomain ?? '').trim().toLowerCase().replace(/^\.+|\.+$/g, '')
      if (baseDomain === '') {
         throw new InvalidTenantError('SubdomainTenantResolver: "baseDomain" is required.')
      }
      this.suffix = `.${baseDomain}`
   }

   /** @inheritdoc */
   resolve(request: TenantRequestInterface): TenantCandidateInterface | undefined {
      const host = (request.host ?? '').toLowerCase().replace(/:\d+$/, '')
      if (!host.endsWith(this.suffix)) {
         return undefined
      }
      const slug = host.slice(0, -this.suffix.length)
      if (!isSlug(slug)) {
         return undefined
      }
      return { slug, path: request.path }
   }
}

/**
 * Reads the tenant from a request header.
 * A header is chosen by the caller: use this resolver only where callers are trusted to name
 * a tenant (service-to-service calls, a gateway that sets the header), and keep the membership check.
 */
export class HeaderTenantResolver implements TenantResolverInterface {
   protected readonly header: string

   /**
    * @param options - `header`: name of the header carrying the slug.
    * @throws InvalidTenantError when the header name is missing.
    */
   constructor(options: { header: string }) {
      const header = (options?.header ?? '').trim().toLowerCase()
      if (header === '') {
         throw new InvalidTenantError('HeaderTenantResolver: "header" is required.')
      }
      this.header = header
   }

   /** @inheritdoc */
   resolve(request: TenantRequestInterface): TenantCandidateInterface | undefined {
      for (const [name, value] of Object.entries(request.headers ?? {})) {
         if (name.toLowerCase() === this.header && isSlug(value)) {
            return { slug: value, path: request.path }
         }
      }
      return undefined
   }
}

/**
 * Tries several resolvers in order and keeps the first answer.
 */
export class ChainTenantResolver implements TenantResolverInterface {
   protected readonly resolvers: TenantResolverInterface[]

   /**
    * @param resolvers - Resolvers, most specific first.
    * @throws InvalidTenantError when the list is empty.
    */
   constructor(resolvers: TenantResolverInterface[]) {
      if (!Array.isArray(resolvers) || resolvers.length === 0) {
         throw new InvalidTenantError('ChainTenantResolver: at least one resolver is required.')
      }
      this.resolvers = [...resolvers]
   }

   /** @inheritdoc */
   resolve(request: TenantRequestInterface): TenantCandidateInterface | undefined {
      for (const resolver of this.resolvers) {
         const candidate = resolver.resolve(request)
         if (candidate) {
            return candidate
         }
      }
      return undefined
   }
}
