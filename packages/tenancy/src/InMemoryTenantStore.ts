import { randomUUID } from 'node:crypto'
import { TenantConflictError, TenantNotFoundError } from './errors'
import type { CreateTenantInterface, MembershipInterface, TenantInterface, TenantStoreInterface, UpdateTenantInterface } from './types'
import { assertCreateTenant, assertIdentifier, assertUpdateTenant, normaliseRoles } from './validation'

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Tenant registry kept in memory: for tests, demos and single-process tools.
 * Returned records are copies, so callers cannot alter the registry by mutating them.
 */
export class InMemoryTenantStore implements TenantStoreInterface {
   protected readonly tenants = new Map<string, TenantInterface>()
   protected readonly memberships = new Map<string, MembershipInterface>()
   protected readonly now: () => Date

   /**
    * @param options - `now`: clock, replaceable in tests.
    */
   constructor(options: { now?: () => Date } = {}) {
      this.now = options.now ?? (() => new Date())
   }

   /** @inheritdoc */
   async createTenant(input: CreateTenantInterface): Promise<TenantInterface> {
      assertCreateTenant(input)
      const id = input.id ?? randomUUID()
      if (this.tenants.has(id)) {
         throw new TenantConflictError('A tenant with this identifier already exists.')
      }
      for (const tenant of this.tenants.values()) {
         if (tenant.slug === input.slug) {
            throw new TenantConflictError(`The slug "${input.slug}" is already taken.`)
         }
      }
      const at = this.now().toISOString()
      const tenant: TenantInterface = {
         id,
         slug: input.slug,
         name: input.name.trim(),
         status: input.status ?? 'active',
         ...(input.entity === undefined ? {} : { entity: input.entity }),
         settings: structuredClone(input.settings ?? {}),
         createdAt: at,
         updatedAt: at,
      }
      this.tenants.set(id, tenant)
      return structuredClone(tenant)
   }

   /** @inheritdoc */
   async getTenant(id: string): Promise<TenantInterface | undefined> {
      const tenant = this.tenants.get(id)
      return tenant ? structuredClone(tenant) : undefined
   }

   /** @inheritdoc */
   async findTenantBySlug(slug: string): Promise<TenantInterface | undefined> {
      for (const tenant of this.tenants.values()) {
         if (tenant.slug === slug) {
            return structuredClone(tenant)
         }
      }
      return undefined
   }

   /** @inheritdoc */
   async listTenants(): Promise<TenantInterface[]> {
      return [...this.tenants.values()].sort((a, b) => byText(a.slug, b.slug)).map((tenant) => structuredClone(tenant))
   }

   /** @inheritdoc */
   async updateTenant(id: string, patch: UpdateTenantInterface): Promise<TenantInterface> {
      assertUpdateTenant(patch)
      const tenant = this.tenants.get(id)
      if (!tenant) {
         throw new TenantNotFoundError('Unknown tenant.')
      }
      const next: TenantInterface = { ...tenant, updatedAt: this.now().toISOString() }
      if (patch.name !== undefined) {
         next.name = patch.name.trim()
      }
      if (patch.status !== undefined) {
         next.status = patch.status
      }
      if (patch.entity === null) {
         delete next.entity
      } else if (patch.entity !== undefined) {
         next.entity = patch.entity
      }
      if (patch.settings !== undefined) {
         next.settings = structuredClone(patch.settings)
      }
      this.tenants.set(id, next)
      return structuredClone(next)
   }

   /** @inheritdoc */
   async putMembership(tenant: string, user: string, roles: string[]): Promise<MembershipInterface> {
      assertIdentifier(user, 'A member user identifier')
      const normalised = normaliseRoles(roles)
      if (!this.tenants.has(tenant)) {
         throw new TenantNotFoundError('Unknown tenant.')
      }
      const key = this.key(tenant, user)
      const at = this.now().toISOString()
      const membership: MembershipInterface = { tenant, user, roles: normalised, createdAt: this.memberships.get(key)?.createdAt ?? at, updatedAt: at }
      this.memberships.set(key, membership)
      return structuredClone(membership)
   }

   /** @inheritdoc */
   async removeMembership(tenant: string, user: string): Promise<boolean> {
      return this.memberships.delete(this.key(tenant, user))
   }

   /** @inheritdoc */
   async getMembership(tenant: string, user: string): Promise<MembershipInterface | undefined> {
      const membership = this.memberships.get(this.key(tenant, user))
      return membership ? structuredClone(membership) : undefined
   }

   /** @inheritdoc */
   async listMemberships(tenant: string): Promise<MembershipInterface[]> {
      return [...this.memberships.values()]
         .filter((membership) => membership.tenant === tenant)
         .sort((a, b) => byText(a.user, b.user))
         .map((membership) => structuredClone(membership))
   }

   /** @inheritdoc */
   async listMembershipsOfUser(user: string): Promise<MembershipInterface[]> {
      return [...this.memberships.values()]
         .filter((membership) => membership.user === user)
         .sort((a, b) => byText(a.tenant, b.tenant))
         .map((membership) => structuredClone(membership))
   }

   protected key(tenant: string, user: string): string {
      return JSON.stringify([tenant, user])
   }
}
