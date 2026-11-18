import { InvalidTenantError } from './errors'
import { currentTenant } from './TenantContext'
import type { TenantInterface } from './types'

/**
 * How to build, and optionally release, one kind of per-tenant resource.
 */
export interface TenantResourceDefinitionInterface<T> {
   /** Builds the resource of a tenant, usually from its settings. */
   create(tenant: TenantInterface): T | Promise<T>
   /**
    * Says what the resource is built from. The resource is rebuilt when this value changes.
    * By default: the status and the whole settings of the tenant.
    */
   fingerprint?(tenant: TenantInterface): unknown
   /** Releases a resource that is replaced or evicted (close a pool, flush a client). */
   dispose?(resource: T): void | Promise<void>
}

/**
 * Handle on one kind of per-tenant resource.
 */
export interface TenantResourceInterface<T> {
   readonly name: string
   /**
    * @param tenant - Tenant to serve; the tenant of the open scope by default.
    * @returns The resource of that tenant, built on first use.
    */
   get(tenant?: TenantInterface): Promise<T>
}

interface EntryInterface {
   fingerprint: string
   resource: Promise<unknown>
}

/**
 * Serialises a value with object keys in a stable order, so two equal contents give equal texts
 * whatever the order their keys were written in.
 *
 * @param value - Any JSON-compatible value.
 * @returns The canonical JSON text.
 */
function canonical(value: unknown): string {
   if (Array.isArray(value)) {
      return `[${value.map(canonical).join(',')}]`
   }
   if (value !== null && typeof value === 'object') {
      const entries = Object.keys(value as object)
         .sort()
         .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      return `{${entries.join(',')}}`
   }
   return JSON.stringify(value) ?? 'null'
}

/**
 * Registry of resources that exist once per tenant: storage client, repository, model adapter…
 * It replaces process-wide singletons: code asks for "the storage" and receives the one of the
 * tenant it runs for. A resource is rebuilt when what it is built from changes.
 */
export class TenantResources {
   protected readonly definitions = new Map<string, TenantResourceDefinitionInterface<unknown>>()
   protected readonly cache = new Map<string, Map<string, EntryInterface>>()

   /**
    * Declares a kind of resource.
    *
    * @param name - Unique name of the resource kind.
    * @param definition - How to build and release it.
    * @returns A typed handle used to obtain the resource.
    * @throws InvalidTenantError when the name is empty or already declared.
    */
   define<T>(name: string, definition: TenantResourceDefinitionInterface<T>): TenantResourceInterface<T> {
      if (typeof name !== 'string' || name === '' || this.definitions.has(name)) {
         throw new InvalidTenantError(`TenantResources: "${name}" is empty or already defined.`)
      }
      if (typeof definition?.create !== 'function') {
         throw new InvalidTenantError(`TenantResources: "${name}" needs a create function.`)
      }
      this.definitions.set(name, definition as TenantResourceDefinitionInterface<unknown>)
      this.cache.set(name, new Map())
      return { name, get: (tenant?: TenantInterface) => this.obtain<T>(name, tenant ?? currentTenant()) }
   }

   /**
    * Releases every resource of a tenant, for instance once it is suspended.
    *
    * @param tenantId - Tenant identifier.
    */
   async evict(tenantId: string): Promise<void> {
      const released: Promise<void>[] = []
      for (const [name, entries] of this.cache) {
         const entry = entries.get(tenantId)
         if (entry) {
            entries.delete(tenantId)
            released.push(this.release(name, entry))
         }
      }
      await Promise.all(released)
   }

   /**
    * Releases every resource of every tenant, typically at shutdown.
    */
   async clear(): Promise<void> {
      const released: Promise<void>[] = []
      for (const [name, entries] of this.cache) {
         for (const entry of entries.values()) {
            released.push(this.release(name, entry))
         }
         entries.clear()
      }
      await Promise.all(released)
   }

   protected async obtain<T>(name: string, tenant: TenantInterface): Promise<T> {
      const definition = this.definitions.get(name) as TenantResourceDefinitionInterface<unknown>
      const entries = this.cache.get(name) as Map<string, EntryInterface>
      const cached = entries.get(tenant.id)
      const fingerprint = canonical(definition.fingerprint ? definition.fingerprint(tenant) : [tenant.status, tenant.settings])
      if (cached && cached.fingerprint === fingerprint) {
         return cached.resource as Promise<T>
      }
      // Concurrent callers share the same promise, so a resource is built once.
      const entry: EntryInterface = { fingerprint, resource: Promise.resolve().then(() => definition.create(tenant)) }
      entries.set(tenant.id, entry)
      entry.resource.catch(() => {
         // A failed build is not kept: the next call tries again.
         if (entries.get(tenant.id) === entry) {
            entries.delete(tenant.id)
         }
      })
      if (cached) {
         await this.release(name, cached)
      }
      return entry.resource as Promise<T>
   }

   protected async release(name: string, entry: EntryInterface): Promise<void> {
      const dispose = this.definitions.get(name)?.dispose
      if (!dispose) {
         return
      }
      let resource: unknown
      try {
         resource = await entry.resource
      } catch {
         return
      }
      await dispose(resource)
   }
}
