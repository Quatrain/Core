import { PersistedBaseObject } from '@quatrain/backend'
import { BaseObjectProperties, Core, StringProperty } from '@quatrain/core'

/**
 * Persisted form of a tenant.
 *
 * `state` holds the tenancy status (active, suspended, archived); the inherited `status` property
 * stays the record lifecycle of every Quatrain object. `settings` holds a JSON document, so the
 * model behaves the same on every backend adapter.
 */
export class Tenant extends PersistedBaseObject {
   static COLLECTION = 'tenants'

   static PROPS_DEFINITION = [
      ...BaseObjectProperties,
      { name: 'slug', type: StringProperty.TYPE, mandatory: true, unique: true },
      { name: 'state', type: StringProperty.TYPE, mandatory: true },
      { name: 'entity', type: StringProperty.TYPE },
      { name: 'settings', type: StringProperty.TYPE },
   ]

   /**
    * Tenant creation factory.
    *
    * @param src - Identifier or content.
    * @returns The Tenant instance.
    */
   static async factory(src: any = undefined): Promise<Tenant> {
      return super.factory(src, Tenant)
   }
}

Core.addClass('Tenant', Tenant)
