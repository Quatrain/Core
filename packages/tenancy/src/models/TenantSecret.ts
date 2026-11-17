import { PersistedBaseObject } from '@quatrain/backend'
import { BaseObjectProperties, Core, HashProperty, StringProperty } from '@quatrain/core'

/**
 * Persisted form of a secret of a tenant: a credential the tenant brings.
 *
 * `name` is the name of the secret. `pair` is a digest of the tenant identifier and that name,
 * declared unique: a tenant holds one value per name. `value` is a reversible `HashProperty`:
 * the record only ever holds the sealed text.
 */
export class TenantSecret extends PersistedBaseObject {
   static COLLECTION = 'tenant_secrets'

   static PROPS_DEFINITION = [
      ...BaseObjectProperties,
      { name: 'pair', type: StringProperty.TYPE, mandatory: true, unique: true },
      { name: 'tenant', type: StringProperty.TYPE, mandatory: true },
      { name: 'value', type: HashProperty.TYPE, algorithm: HashProperty.ALGORITHM_AES256GCM, mandatory: true },
   ]

   /**
    * Secret creation factory.
    *
    * @param src - Identifier or content.
    * @returns The TenantSecret instance.
    */
   static async factory(src: any = undefined): Promise<TenantSecret> {
      return super.factory(src, TenantSecret)
   }
}

Core.addClass('TenantSecret', TenantSecret)
