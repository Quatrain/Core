import { randomBytes } from 'node:crypto'
import { InvalidTenantError, SecretUnreadableError } from './errors'
import { SQLiteAdapter } from '@quatrain/backend-sqlite'
import { HashProperty } from '@quatrain/core'
import { TenantSecretRepository } from './TenantSecretRepository'
import { InMemoryTenantSecretStore, TenantSecrets, type TenantSecretStoreInterface } from './TenantSecrets'

const key = () => randomBytes(32)

const backend = new SQLiteAdapter({ config: { database: ':memory:' } })

afterAll(async () => {
   await backend.close()
})

/**
 * Both stores are exercised: the one kept in memory, and the repository on an in-memory SQLite
 * database, a real adapter that enforces unique properties.
 */
const STORES: [string, () => TenantSecretStoreInterface][] = [
   ['InMemoryTenantSecretStore', () => new InMemoryTenantSecretStore()],
   ['TenantSecretRepository', () => new TenantSecretRepository(backend)],
]

describe.each(STORES)('TenantSecrets over %s', (label, open) => {
   let sequence = 0
   // The repository keeps its records between tests: each test works on tenants of its own
   const tenants = () => {
      sequence += 1
      return { acme: `${label}-acme-${sequence}`, globex: `${label}-globex-${sequence}` }
   }
   const build = () => {
      const store = open()
      return { store, secrets: new TenantSecrets(store, { key: key() }), ...tenants() }
   }

   afterEach(() => HashProperty.setDefaultKey(undefined))

   it('keeps only sealed values in the store', async () => {
      const { store, secrets, acme } = build()
      await secrets.set(acme, 'storage.secret', 'clear-value')

      expect(await store.read(acme, 'storage.secret')).not.toContain('clear-value')
      expect(await secrets.get(acme, 'storage.secret')).toBe('clear-value')
   })

   it('separates tenants', async () => {
      const { store, secrets, acme, globex } = build()
      await secrets.set(acme, 'model.key', 'key-of-acme')
      await secrets.set(globex, 'model.key', 'key-of-globex')

      expect(await secrets.get(acme, 'model.key')).toBe('key-of-acme')
      expect(await secrets.get(globex, 'model.key')).toBe('key-of-globex')

      // A sealed value moved to another tenant does not open
      await store.write(globex, 'model.key', (await store.read(acme, 'model.key'))!)
      await expect(secrets.get(globex, 'model.key')).rejects.toThrow(SecretUnreadableError)
   })

   it('lists names, tells presence, replaces and deletes', async () => {
      const { secrets, acme, globex } = build()
      await secrets.set(acme, 'storage.secret', 'one')
      await secrets.set(acme, 'model.key', 'two')
      await secrets.set(acme, 'model.key', 'three')

      expect(await secrets.names(acme)).toEqual(['model.key', 'storage.secret'])
      expect(await secrets.names(globex)).toEqual([])
      expect(await secrets.get(acme, 'model.key')).toBe('three')
      expect(await secrets.has(acme, 'model.key')).toBe(true)
      expect(await secrets.delete(acme, 'model.key')).toBe(true)
      expect(await secrets.delete(acme, 'model.key')).toBe(false)
      expect(await secrets.has(acme, 'model.key')).toBe(false)
      expect(await secrets.get(acme, 'model.key')).toBeUndefined()
   })

   it('refuses malformed names and values', async () => {
      const { secrets, acme } = build()

      await expect(secrets.set(acme, 'Model Key', 'value')).rejects.toThrow(InvalidTenantError)
      await expect(secrets.set(acme, '', 'value')).rejects.toThrow(InvalidTenantError)
      await expect(secrets.set(acme, 'model.key', '')).rejects.toThrow(InvalidTenantError)
      await expect(secrets.set('', 'model.key', 'value')).rejects.toThrow(InvalidTenantError)
   })
})

describe('TenantSecrets keys', () => {
   afterEach(() => HashProperty.setDefaultKey(undefined))

   it('uses the key set for the process when it is given none', async () => {
      HashProperty.setDefaultKey(key())
      const secrets = new TenantSecrets(new InMemoryTenantSecretStore())
      await secrets.set('acme', 'model.key', 'value')

      expect(await secrets.get('acme', 'model.key')).toBe('value')
   })

   it('cannot read a secret back under another key, nor a value stored in clear', async () => {
      const store = new InMemoryTenantSecretStore()
      await new TenantSecrets(store, { key: key() }).set('acme', 'model.key', 'value')
      await store.write('acme', 'storage.secret', 'stored-in-clear')
      const other = new TenantSecrets(store, { key: key() })

      await expect(other.get('acme', 'model.key')).rejects.toThrow(SecretUnreadableError)
      await expect(other.get('acme', 'storage.secret')).rejects.toThrow(SecretUnreadableError)
      await expect(other.get('acme', 'storage.secret')).rejects.not.toThrow('stored-in-clear')
   })
})
