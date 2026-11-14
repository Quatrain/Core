import { InvalidTenantError, NotAMemberError, TenantNotFoundError, TenantUnavailableError } from './errors'
import { runInTenant } from './TenantContext'
import type {
   ActorType,
   CreateTenantInterface,
   ScopeEnvelopeInterface,
   TenantInterface,
   TenantManifestInterface,
   TenantRequestInterface,
   TenantResolverInterface,
   TenantScopeInterface,
   TenantStoreInterface,
} from './types'
import { actorUser, assertSlug } from './validation'

const MANIFEST_FORMAT = 'quatrain.tenancy/1'

/**
 * Settings of the tenancy service.
 */
export interface TenancyOptionsInterface {
   /** Tenant registry. */
   store: TenantStoreInterface
   /** How requests name their tenant. Needed by `scopeForRequest` only. */
   resolver?: TenantResolverInterface
   /** Slugs no tenant may take, typically the host's own top-level routes. */
   reservedSlugs?: string[]
   /** Clock, replaceable in tests. */
   now?: () => Date
}

/**
 * Entry point of the tenancy layer: turns a request, a slug or a queue envelope into a checked
 * scope, and runs work inside it.
 *
 * A scope is granted only when the tenant exists, is active, and — for a user — when that user is
 * a member. Hosts facing untrusted callers should answer `TenantNotFoundError`,
 * `TenantUnavailableError` and `NotAMemberError` alike, so tenant names cannot be probed.
 */
export class Tenancy {
   protected readonly store: TenantStoreInterface
   protected readonly resolver?: TenantResolverInterface
   protected readonly reserved: Set<string>
   protected readonly now: () => Date

   /**
    * @param options - Registry, resolver and reserved slugs.
    * @throws InvalidTenantError when the store is missing or a reserved slug is malformed.
    */
   constructor(options: TenancyOptionsInterface) {
      if (!options?.store) {
         throw new InvalidTenantError('Tenancy: "store" is required.')
      }
      this.store = options.store
      this.resolver = options.resolver
      this.now = options.now ?? (() => new Date())
      this.reserved = new Set()
      for (const slug of options.reservedSlugs ?? []) {
         assertSlug(slug)
         this.reserved.add(slug)
      }
   }

   /**
    * Creates a tenant after checking the reserved slugs.
    *
    * @param input - Creation values.
    * @returns The created tenant.
    * @throws InvalidTenantError when the slug is reserved or a value is malformed.
    * @throws TenantConflictError when the slug or identifier is taken.
    */
   async createTenant(input: CreateTenantInterface): Promise<TenantInterface> {
      if (this.reserved.has(input?.slug)) {
         throw new InvalidTenantError(`The slug "${input.slug}" is reserved.`)
      }
      return this.store.createTenant(input)
   }

   /**
    * Builds the scope of an incoming request.
    *
    * @param request - Path, host and headers of the request.
    * @param actor - Authenticated user, or named system process.
    * @returns The checked scope, with the request path stripped of its tenant part.
    * @throws TenantNotFoundError when the request names no known tenant.
    * @throws TenantUnavailableError when the tenant is not active.
    * @throws NotAMemberError when the user is not a member.
    */
   async scopeForRequest(request: TenantRequestInterface, actor: ActorType): Promise<TenantScopeInterface> {
      if (!this.resolver) {
         throw new InvalidTenantError('Tenancy: a "resolver" is required to scope requests.')
      }
      const candidate = this.resolver.resolve(request)
      if (!candidate) {
         throw new TenantNotFoundError('The request names no tenant.')
      }
      const scope = await this.check(await this.store.findTenantBySlug(candidate.slug), actor)
      return { ...scope, path: candidate.path }
   }

   /**
    * Builds the scope of a tenant known by its slug.
    *
    * @param slug - Tenant slug.
    * @param actor - Authenticated user, or named system process.
    * @returns The checked scope.
    * @throws TenantNotFoundError | TenantUnavailableError | NotAMemberError
    */
   async scopeForSlug(slug: string, actor: ActorType): Promise<TenantScopeInterface> {
      return this.check(await this.store.findTenantBySlug(slug), actor)
   }

   /**
    * Reopens a scope carried by a queue message or another process. The tenant and the membership
    * are read again: a tenant suspended, or a member removed, since the message was sent is refused.
    *
    * @param envelope - Result of `scopeEnvelope()`.
    * @returns The checked scope.
    * @throws TenantNotFoundError | TenantUnavailableError | NotAMemberError
    */
   async scopeForEnvelope(envelope: ScopeEnvelopeInterface): Promise<TenantScopeInterface> {
      if (!envelope || typeof envelope.tenant !== 'string') {
         throw new InvalidTenantError('A scope envelope needs a tenant identifier.')
      }
      return this.check(await this.store.getTenant(envelope.tenant), envelope.actor)
   }

   /**
    * Runs work inside a scope. Shorthand for `runInTenant`.
    *
    * @param scope - Scope returned by one of the `scopeFor…` methods.
    * @param fn - Work to run for the tenant.
    * @returns What `fn` returns.
    */
   run<T>(scope: TenantScopeInterface, fn: () => T): T {
      return runInTenant(scope, fn)
   }

   /**
    * Describes a tenant registry entry in a portable form.
    * It covers the registry only; each tenant resource (files, repositories, databases) is exported by its owner.
    *
    * @param id - Tenant identifier.
    * @returns The tenant and its memberships.
    * @throws TenantNotFoundError when the tenant does not exist.
    */
   async exportTenant(id: string): Promise<TenantManifestInterface> {
      const tenant = await this.store.getTenant(id)
      if (!tenant) {
         throw new TenantNotFoundError('Unknown tenant.')
      }
      return { format: MANIFEST_FORMAT, exportedAt: this.now().toISOString(), tenant, memberships: await this.store.listMemberships(id) }
   }

   /**
    * Recreates a tenant from a manifest, keeping its identifier, on an instance where it does not exist.
    * User identifiers are kept as they are: they must mean the same users on the target instance.
    *
    * @param manifest - Result of `exportTenant()`.
    * @returns The created tenant.
    * @throws InvalidTenantError when the manifest is malformed or of an unknown format.
    * @throws TenantConflictError when the slug or identifier is taken.
    */
   async importTenant(manifest: TenantManifestInterface): Promise<TenantInterface> {
      if (!manifest || manifest.format !== MANIFEST_FORMAT || !manifest.tenant || !Array.isArray(manifest.memberships)) {
         throw new InvalidTenantError(`A tenant manifest of format "${MANIFEST_FORMAT}" is expected.`)
      }
      const { id, slug, name, status, entity, settings } = manifest.tenant
      for (const membership of manifest.memberships) {
         if (!membership || membership.tenant !== id) {
            throw new InvalidTenantError('The manifest holds a membership of another tenant.')
         }
      }
      const tenant = await this.createTenant({ id, slug, name, status, entity, settings })
      for (const membership of manifest.memberships) {
         await this.store.putMembership(tenant.id, membership.user, membership.roles)
      }
      return tenant
   }

   protected async check(tenant: TenantInterface | undefined, actor: ActorType): Promise<TenantScopeInterface> {
      const user = actorUser(actor)
      if (!tenant) {
         throw new TenantNotFoundError('Unknown tenant.')
      }
      if (tenant.status !== 'active') {
         throw new TenantUnavailableError(`The tenant is ${tenant.status}.`)
      }
      if (user === undefined) {
         return { tenant, actor }
      }
      const membership = await this.store.getMembership(tenant.id, user)
      if (!membership) {
         throw new NotAMemberError('The user is not a member of the tenant.')
      }
      return { tenant, actor, membership }
   }
}
