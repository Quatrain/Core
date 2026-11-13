import { createHash } from 'node:crypto'
import { Backend, Filter, Limits, SortAndLimit, Sorting, UniqueConstraintError, type BackendInterface, type DataObjectClass } from '@quatrain/backend'
import { NotFoundError } from '@quatrain/core'
import { TenantConflictError, TenantNotFoundError } from './errors'
import { Membership } from './models/Membership'
import { Tenant } from './models/Tenant'
import type { CreateTenantInterface, MembershipInterface, TenantInterface, TenantStatus, TenantStoreInterface, UpdateTenantInterface } from './types'
import { assertCreateTenant, assertIdentifier, assertUpdateTenant, normaliseRoles } from './validation'

/** Upper bound of a listing; a registry holds far fewer tenants or members per tenant. */
const LIST_LIMIT = 10000

function isoDate(value: unknown): string | undefined {
   if (value === undefined || value === null || value === '') {
      return undefined
   }
   const date = new Date(value as string | number | Date)
   return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function parseJson<T>(value: unknown, fallback: T): T {
   if (typeof value !== 'string' || value === '') {
      return fallback
   }
   try {
      return JSON.parse(value) as T
   } catch {
      return fallback
   }
}

function optional<K extends string>(key: K, value: string | undefined): { [P in K]?: string } {
   return (value === undefined ? {} : { [key]: value }) as { [P in K]?: string }
}

/**
 * Tenant registry stored through a Quatrain backend adapter: the tenants and memberships are
 * ordinary models, so the registry works on any adapter (PostgreSQL, SQLite…).
 *
 * Uniqueness of slugs and of (tenant, member) pairs relies on the `unique` property option: use
 * an adapter that enforces it.
 */
export class TenancyRepository implements TenantStoreInterface {
   protected readonly backend: BackendInterface

   /**
    * @param backend - Adapter holding the registry; the default backend when omitted.
    */
   constructor(backend: BackendInterface = Backend.getBackend()) {
      this.backend = backend
   }

   /** @inheritdoc */
   async createTenant(input: CreateTenantInterface): Promise<TenantInterface> {
      assertCreateTenant(input)
      const tenant = Tenant.fromObject({
         name: input.name.trim(),
         slug: input.slug,
         state: input.status ?? 'active',
         ...optional('entity', input.entity),
         settings: JSON.stringify(input.settings ?? {}),
      } as never)
      try {
         return this.toTenant(await this.backend.create(tenant.dataObject, input.id))
      } catch (error) {
         if (error instanceof UniqueConstraintError) {
            throw new TenantConflictError('The slug or the identifier is already taken.')
         }
         throw error
      }
   }

   /** @inheritdoc */
   async getTenant(id: string): Promise<TenantInterface | undefined> {
      const dataObject = await this.readTenant(id)
      return dataObject ? this.toTenant(dataObject) : undefined
   }

   /** @inheritdoc */
   async findTenantBySlug(slug: string): Promise<TenantInterface | undefined> {
      const [dataObject] = await this.find(Tenant, [new Filter('slug', slug)], 'slug', 1)
      return dataObject ? this.toTenant(dataObject) : undefined
   }

   /** @inheritdoc */
   async listTenants(): Promise<TenantInterface[]> {
      return (await this.find(Tenant, [], 'slug')).map((dataObject) => this.toTenant(dataObject))
   }

   /** @inheritdoc */
   async updateTenant(id: string, patch: UpdateTenantInterface): Promise<TenantInterface> {
      assertUpdateTenant(patch)
      const dataObject = await this.readTenant(id)
      if (!dataObject) {
         throw new TenantNotFoundError('Unknown tenant.')
      }
      if (patch.name !== undefined) {
         dataObject.set('name', patch.name.trim())
      }
      if (patch.status !== undefined) {
         dataObject.set('state', patch.status)
      }
      if (patch.entity !== undefined) {
         dataObject.set('entity', patch.entity ?? '')
      }
      if (patch.settings !== undefined) {
         dataObject.set('settings', JSON.stringify(patch.settings))
      }
      return this.toTenant(await this.backend.update(dataObject))
   }

   /** @inheritdoc */
   async putMembership(tenant: string, user: string, roles: string[]): Promise<MembershipInterface> {
      assertIdentifier(user, 'A member user identifier')
      const normalised = JSON.stringify(normaliseRoles(roles))
      if (!(await this.readTenant(tenant))) {
         throw new TenantNotFoundError('Unknown tenant.')
      }
      const existing = await this.findMembership(tenant, user)
      if (existing) {
         existing.set('roles', normalised)
         return this.toMembership(await this.backend.update(existing))
      }
      const membership = Membership.fromObject({ name: user, pair: this.pair(tenant, user), tenant, member: user, roles: normalised } as never)
      try {
         return this.toMembership(await this.backend.create(membership.dataObject, undefined))
      } catch (error) {
         if (!(error instanceof UniqueConstraintError)) {
            throw error
         }
         // Created by a concurrent call between the lookup and the insert: update that record.
         const concurrent = await this.findMembership(tenant, user)
         if (!concurrent) {
            throw error
         }
         concurrent.set('roles', normalised)
         return this.toMembership(await this.backend.update(concurrent))
      }
   }

   /** @inheritdoc */
   async removeMembership(tenant: string, user: string): Promise<boolean> {
      const existing = await this.findMembership(tenant, user)
      if (!existing) {
         return false
      }
      await this.backend.delete(existing, true)
      return true
   }

   /** @inheritdoc */
   async getMembership(tenant: string, user: string): Promise<MembershipInterface | undefined> {
      const dataObject = await this.findMembership(tenant, user)
      return dataObject ? this.toMembership(dataObject) : undefined
   }

   /** @inheritdoc */
   async listMemberships(tenant: string): Promise<MembershipInterface[]> {
      return (await this.find(Membership, [new Filter('tenant', tenant)], 'member')).map((dataObject) => this.toMembership(dataObject))
   }

   /** @inheritdoc */
   async listMembershipsOfUser(user: string): Promise<MembershipInterface[]> {
      return (await this.find(Membership, [new Filter('member', user)], 'tenant')).map((dataObject) => this.toMembership(dataObject))
   }

   protected pair(tenant: string, user: string): string {
      return createHash('sha256').update(JSON.stringify([tenant, user])).digest('hex')
   }

   protected async readTenant(id: string): Promise<DataObjectClass<any> | undefined> {
      // A record path is `<collection>/<id>`: an identifier holding a slash cannot name a tenant.
      if (typeof id !== 'string' || id === '' || id.includes('/')) {
         return undefined
      }
      const dataObject = (await Tenant.factory()).dataObject
      dataObject.uri.path = `${Tenant.COLLECTION}/${id}`
      try {
         return await this.backend.read(dataObject)
      } catch (error) {
         if (error instanceof NotFoundError) {
            return undefined
         }
         throw error
      }
   }

   protected async findMembership(tenant: string, user: string): Promise<DataObjectClass<any> | undefined> {
      const [dataObject] = await this.find(Membership, [new Filter('pair', this.pair(tenant, user))], 'pair', 1)
      return dataObject
   }

   protected async find(model: typeof Tenant | typeof Membership, filters: Filter[], sortBy: string, limit = LIST_LIMIT): Promise<DataObjectClass<any>[]> {
      const template = (await model.factory()).dataObject
      const result = await this.backend.find(template, filters, new SortAndLimit([new Sorting(sortBy)], new Limits(0, limit)), undefined)
      return result.items
   }

   protected toTenant(dataObject: DataObjectClass<any>): TenantInterface {
      const entity = dataObject.val('entity')
      return {
         id: dataObject.uid as string,
         slug: dataObject.val('slug'),
         name: dataObject.val('name'),
         status: dataObject.val('state') as TenantStatus,
         ...optional('entity', typeof entity === 'string' && entity !== '' ? entity : undefined),
         settings: parseJson<Record<string, unknown>>(dataObject.val('settings'), {}),
         ...optional('createdAt', isoDate(dataObject.val('createdAt'))),
         ...optional('updatedAt', isoDate(dataObject.val('updatedAt'))),
      }
   }

   protected toMembership(dataObject: DataObjectClass<any>): MembershipInterface {
      return {
         tenant: dataObject.val('tenant'),
         user: dataObject.val('member'),
         roles: parseJson<string[]>(dataObject.val('roles'), []),
         ...optional('createdAt', isoDate(dataObject.val('createdAt'))),
         ...optional('updatedAt', isoDate(dataObject.val('updatedAt'))),
      }
   }
}
