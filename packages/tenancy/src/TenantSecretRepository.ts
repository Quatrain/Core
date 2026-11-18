import { createHash } from 'node:crypto'
import { Backend, Filter, Limits, SortAndLimit, Sorting, UniqueConstraintError, type BackendInterface, type DataObjectClass } from '@quatrain/backend'
import { TenantSecret } from './models/TenantSecret'
import type { TenantSecretStoreInterface } from './TenantSecrets'

/** Upper bound of a listing; a tenant holds a handful of secrets. */
const LIST_LIMIT = 1000

/**
 * Sealed secrets of tenants stored through a Quatrain backend adapter, as `TenantSecret`
 * records. Uniqueness of a name within a tenant relies on the `unique` property option: use an
 * adapter that enforces it.
 */
export class TenantSecretRepository implements TenantSecretStoreInterface {
   protected readonly backend: BackendInterface

   /**
    * @param backend - Adapter holding the secrets; the default backend when omitted.
    */
   constructor(backend: BackendInterface = Backend.getBackend()) {
      this.backend = backend
   }

   /** @inheritdoc */
   async read(tenant: string, name: string): Promise<string | undefined> {
      const value = (await this.findOne(tenant, name))?.val('value')
      return typeof value === 'string' && value !== '' ? value : undefined
   }

   /** @inheritdoc */
   async write(tenant: string, name: string, sealed: string): Promise<void> {
      const existing = await this.findOne(tenant, name)
      if (existing) {
         existing.set('value', sealed)
         await this.backend.update(existing)
         return
      }
      const secret = TenantSecret.fromObject({ name, pair: this.pair(tenant, name), tenant, value: sealed } as never)
      try {
         await this.backend.create(secret.dataObject, undefined)
      } catch (error) {
         if (!(error instanceof UniqueConstraintError)) {
            throw error
         }
         // Created by a concurrent call between the lookup and the insert: update that record.
         const concurrent = await this.findOne(tenant, name)
         if (!concurrent) {
            throw error
         }
         concurrent.set('value', sealed)
         await this.backend.update(concurrent)
      }
   }

   /** @inheritdoc */
   async remove(tenant: string, name: string): Promise<boolean> {
      const existing = await this.findOne(tenant, name)
      if (!existing) {
         return false
      }
      await this.backend.delete(existing, true)
      return true
   }

   /** @inheritdoc */
   async names(tenant: string): Promise<string[]> {
      const found = await this.find([new Filter('tenant', tenant)], LIST_LIMIT)
      return found.map((dataObject) => dataObject.val('name') as string).sort()
   }

   protected pair(tenant: string, name: string): string {
      return createHash('sha256').update(JSON.stringify([tenant, name])).digest('hex')
   }

   protected async findOne(tenant: string, name: string): Promise<DataObjectClass<any> | undefined> {
      const [dataObject] = await this.find([new Filter('pair', this.pair(tenant, name))], 1)
      return dataObject
   }

   protected async find(filters: Filter[], limit: number): Promise<DataObjectClass<any>[]> {
      const template = (await TenantSecret.factory()).dataObject
      const result = await this.backend.find(template, filters, new SortAndLimit([new Sorting('pair')], new Limits(0, limit)), undefined)
      return result.items
   }
}
