import { InvalidTenantError } from './errors'
import type { SecretSealer } from './SecretSealer'
import { assertIdentifier } from './validation'

const SECRET_NAME = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const MAX_NAME_LENGTH = 100
const MAX_VALUE_LENGTH = 16384

/**
 * Where the sealed secrets of tenants are kept. A store only ever receives sealed values.
 */
export interface TenantSecretStoreInterface {
   /** Returns the sealed value, or `undefined` when the tenant holds no secret of that name. */
   read(tenant: string, name: string): Promise<string | undefined>
   /** Writes the sealed value, replacing the previous one. */
   write(tenant: string, name: string, sealed: string): Promise<void>
   /** Removes the secret. Returns whether one existed. */
   remove(tenant: string, name: string): Promise<boolean>
   /** Lists the names of the secrets a tenant holds, sorted. */
   names(tenant: string): Promise<string[]>
}

/**
 * Sealed-secret store kept in memory: for tests and single-process tools.
 */
export class InMemoryTenantSecretStore implements TenantSecretStoreInterface {
   protected readonly values = new Map<string, Map<string, string>>()

   /** @inheritdoc */
   async read(tenant: string, name: string): Promise<string | undefined> {
      return this.values.get(tenant)?.get(name)
   }

   /** @inheritdoc */
   async write(tenant: string, name: string, sealed: string): Promise<void> {
      const ofTenant = this.values.get(tenant) ?? new Map<string, string>()
      ofTenant.set(name, sealed)
      this.values.set(tenant, ofTenant)
   }

   /** @inheritdoc */
   async remove(tenant: string, name: string): Promise<boolean> {
      return this.values.get(tenant)?.delete(name) ?? false
   }

   /** @inheritdoc */
   async names(tenant: string): Promise<string[]> {
      return Array.from(this.values.get(tenant)?.keys() ?? []).sort()
   }
}

/**
 * Secrets a tenant brings: credentials of its storage, its model provider, its repository…
 * Values are sealed before they reach the store and only opened for the tenant and the name
 * they were sealed for. Listing gives names, never values.
 */
export class TenantSecrets {
   /**
    * @param store - Where sealed values are kept.
    * @param sealer - Seals and opens the values.
    */
   constructor(
      protected readonly store: TenantSecretStoreInterface,
      protected readonly sealer: SecretSealer
   ) {}

   /**
    * Sets a secret of a tenant, replacing the previous value.
    *
    * @param tenant - Tenant identifier.
    * @param name - Name of the secret: lowercase words joined by `.`, `-` or `_`.
    * @param value - Clear value, not empty.
    * @throws InvalidTenantError when the tenant, the name or the value is malformed.
    */
   async set(tenant: string, name: string, value: string): Promise<void> {
      TenantSecrets.assertKey(tenant, name)
      if (typeof value !== 'string' || value === '' || value.length > MAX_VALUE_LENGTH) {
         throw new InvalidTenantError(`A secret value is a non-empty string of at most ${MAX_VALUE_LENGTH} characters.`)
      }
      await this.store.write(tenant, name, this.sealer.seal(value, { tenant, name }))
   }

   /**
    * Reads a secret of a tenant.
    *
    * @param tenant - Tenant identifier.
    * @param name - Name of the secret.
    * @returns The clear value, or `undefined` when the tenant holds no secret of that name.
    * @throws SecretUnreadableError when the stored value does not open.
    */
   async get(tenant: string, name: string): Promise<string | undefined> {
      TenantSecrets.assertKey(tenant, name)
      const sealed = await this.store.read(tenant, name)
      return sealed === undefined ? undefined : this.sealer.open(sealed, { tenant, name })
   }

   /**
    * Tells whether a tenant holds a secret, without opening it.
    *
    * @param tenant - Tenant identifier.
    * @param name - Name of the secret.
    */
   async has(tenant: string, name: string): Promise<boolean> {
      TenantSecrets.assertKey(tenant, name)
      return (await this.store.read(tenant, name)) !== undefined
   }

   /**
    * Lists the names of the secrets a tenant holds.
    *
    * @param tenant - Tenant identifier.
    * @returns The names, sorted.
    */
   async names(tenant: string): Promise<string[]> {
      assertIdentifier(tenant, 'The tenant')
      return this.store.names(tenant)
   }

   /**
    * Deletes a secret of a tenant.
    *
    * @param tenant - Tenant identifier.
    * @param name - Name of the secret.
    * @returns Whether a secret existed.
    */
   async delete(tenant: string, name: string): Promise<boolean> {
      TenantSecrets.assertKey(tenant, name)
      return this.store.remove(tenant, name)
   }

   protected static assertKey(tenant: string, name: string): void {
      assertIdentifier(tenant, 'The tenant')
      if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH || !SECRET_NAME.test(name)) {
         throw new InvalidTenantError('A secret name is made of lowercase words joined by ".", "-" or "_".')
      }
   }
}
