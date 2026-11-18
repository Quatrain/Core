/**
 * Lifecycle of a tenant. Only an `active` tenant can be entered.
 */
export type TenantStatus = 'active' | 'suspended' | 'archived'

/**
 * One isolated customer space of a shared instance.
 */
export interface TenantInterface {
   /** Stable identifier, never reused. */
   id: string
   /** URL-safe unique name, immutable once created. */
   slug: string
   /** Display name. */
   name: string
   status: TenantStatus
   /** Reference of the organisation record the tenant belongs to (for instance an `Entity` path). */
   entity?: string
   /** Free-form settings owned by the host application. */
   settings: Record<string, unknown>
   /** ISO 8601 timestamps, when the store records them. */
   createdAt?: string
   updatedAt?: string
}

/**
 * Link between a user and a tenant, with the roles held in that tenant.
 */
export interface MembershipInterface {
   /** Tenant identifier. */
   tenant: string
   /** User identifier, as issued by the authentication layer. */
   user: string
   /** Role names, unique and sorted. Their meaning belongs to the authorisation layer. */
   roles: string[]
   /** ISO 8601 timestamps, when the store records them. */
   createdAt?: string
   updatedAt?: string
}

/**
 * Values accepted when creating a tenant.
 */
export interface CreateTenantInterface {
   slug: string
   name: string
   /** Imposed identifier, used when importing a tenant; generated otherwise. */
   id?: string
   status?: TenantStatus
   entity?: string
   settings?: Record<string, unknown>
}

/**
 * Values accepted when updating a tenant. `entity: null` clears the reference.
 */
export interface UpdateTenantInterface {
   name?: string
   status?: TenantStatus
   entity?: string | null
   settings?: Record<string, unknown>
}

/**
 * Persistence port of the tenant registry.
 * The registry is read before any tenant scope exists, so it is never tenant-scoped itself.
 */
export interface TenantStoreInterface {
   /** @throws TenantConflictError when the slug or the identifier is already taken. */
   createTenant(input: CreateTenantInterface): Promise<TenantInterface>
   getTenant(id: string): Promise<TenantInterface | undefined>
   findTenantBySlug(slug: string): Promise<TenantInterface | undefined>
   /** Tenants ordered by slug. */
   listTenants(): Promise<TenantInterface[]>
   /** @throws TenantNotFoundError when the tenant does not exist. */
   updateTenant(id: string, patch: UpdateTenantInterface): Promise<TenantInterface>
   /** Creates the membership or replaces its roles. @throws TenantNotFoundError */
   putMembership(tenant: string, user: string, roles: string[]): Promise<MembershipInterface>
   /** @returns whether a membership was removed. */
   removeMembership(tenant: string, user: string): Promise<boolean>
   getMembership(tenant: string, user: string): Promise<MembershipInterface | undefined>
   /** Memberships of a tenant ordered by user. */
   listMemberships(tenant: string): Promise<MembershipInterface[]>
   /** Memberships of a user ordered by tenant. */
   listMembershipsOfUser(user: string): Promise<MembershipInterface[]>
}

/**
 * Who acts inside a tenant scope: an authenticated user, whose membership is checked,
 * or a named system process (worker, scheduler, migration) that needs none.
 */
export type ActorType = { user: string } | { system: string }

/**
 * Everything known about the tenant a piece of work runs for.
 */
export interface TenantScopeInterface {
   tenant: TenantInterface
   actor: ActorType
   /** Present when the actor is a user. */
   membership?: MembershipInterface
   /** Request path once the tenant part is removed, when the scope comes from a request. */
   path?: string
}

/**
 * Serialisable form of a scope, to carry it through a queue or to another process.
 */
export interface ScopeEnvelopeInterface {
   tenant: string
   actor: ActorType
}

/**
 * Transport-neutral view of an incoming request.
 */
export interface TenantRequestInterface {
   /** URL path, without query string. */
   path: string
   /** Host header, with or without port. */
   host?: string
   headers?: Record<string, string | undefined>
}

/**
 * Tenant named by a request, before it is checked against the registry.
 */
export interface TenantCandidateInterface {
   slug: string
   /** Request path once the tenant part is removed. */
   path: string
}

/**
 * Finds which tenant a request names.
 */
export interface TenantResolverInterface {
   resolve(request: TenantRequestInterface): TenantCandidateInterface | undefined
}

/**
 * Portable description of a tenant registry entry.
 */
export interface TenantManifestInterface {
   format: 'quatrain.tenancy/1'
   exportedAt: string
   tenant: TenantInterface
   memberships: MembershipInterface[]
}
