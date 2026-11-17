import { randomBytes } from 'node:crypto'
import { InvalidTenantError, SecretUnreadableError } from './errors'
import { SecretSealer } from './SecretSealer'
import { InMemoryTenantSecretStore, TenantSecrets } from './TenantSecrets'

const key = () => randomBytes(32)
const context = { tenant: 'acme', name: 'storage.secret' }

describe('SecretSealer', () => {
   it('opens what it sealed, and seals the same value differently each time', () => {
      const sealer = new SecretSealer(key())
      const first = sealer.seal('s3cr3t-välue', context)
      const second = sealer.seal('s3cr3t-välue', context)

      expect(first).not.toContain('s3cr3t')
      expect(first).not.toBe(second)
      expect(sealer.open(first, context)).toBe('s3cr3t-välue')
   })

   it('accepts a base64 key and refuses a key of another length', () => {
      const bytes = key()
      const sealed = new SecretSealer(bytes.toString('base64')).seal('value', context)

      expect(new SecretSealer(bytes).open(sealed, context)).toBe('value')
      expect(() => new SecretSealer(randomBytes(16))).toThrow(InvalidTenantError)
      expect(() => new SecretSealer('not a key')).toThrow(InvalidTenantError)
   })

   it('refuses a value sealed for another tenant, another name or under another key', () => {
      const sealer = new SecretSealer(key())
      const sealed = sealer.seal('value', context)

      expect(() => sealer.open(sealed, { ...context, tenant: 'other' })).toThrow(SecretUnreadableError)
      expect(() => sealer.open(sealed, { ...context, name: 'model.key' })).toThrow(SecretUnreadableError)
      expect(() => new SecretSealer(key()).open(sealed, context)).toThrow(SecretUnreadableError)
   })

   it('refuses an altered or malformed value without revealing it', () => {
      const sealer = new SecretSealer(key())
      const parts = sealer.seal('value', context).split('.')
      const altered = [parts[0], parts[1], parts[2], Buffer.from('other').toString('base64url')].join('.')

      expect(() => sealer.open(altered, context)).toThrow(SecretUnreadableError)
      expect(() => sealer.open('plain text', context)).toThrow(SecretUnreadableError)
      expect(() => sealer.open('v2.a.b.c', context)).toThrow(SecretUnreadableError)
      try {
         sealer.open('leaked-value', context)
      } catch (error) {
         expect((error as Error).message).not.toContain('leaked-value')
      }
   })
})

describe('TenantSecrets', () => {
   const build = () => {
      const store = new InMemoryTenantSecretStore()
      return { store, secrets: new TenantSecrets(store, new SecretSealer(key())) }
   }

   it('keeps only sealed values in the store', async () => {
      const { store, secrets } = build()
      await secrets.set('acme', 'storage.secret', 'clear-value')

      expect(await store.read('acme', 'storage.secret')).not.toContain('clear-value')
      expect(await secrets.get('acme', 'storage.secret')).toBe('clear-value')
   })

   it('separates tenants', async () => {
      const { store, secrets } = build()
      await secrets.set('acme', 'model.key', 'key-of-acme')
      await secrets.set('globex', 'model.key', 'key-of-globex')

      expect(await secrets.get('acme', 'model.key')).toBe('key-of-acme')
      expect(await secrets.get('globex', 'model.key')).toBe('key-of-globex')

      // A sealed value moved to another tenant does not open
      await store.write('globex', 'model.key', (await store.read('acme', 'model.key'))!)
      await expect(secrets.get('globex', 'model.key')).rejects.toThrow(SecretUnreadableError)
   })

   it('lists names, tells presence, replaces and deletes', async () => {
      const { secrets } = build()
      await secrets.set('acme', 'storage.secret', 'one')
      await secrets.set('acme', 'model.key', 'two')
      await secrets.set('acme', 'model.key', 'three')

      expect(await secrets.names('acme')).toEqual(['model.key', 'storage.secret'])
      expect(await secrets.names('globex')).toEqual([])
      expect(await secrets.get('acme', 'model.key')).toBe('three')
      expect(await secrets.has('acme', 'model.key')).toBe(true)
      expect(await secrets.delete('acme', 'model.key')).toBe(true)
      expect(await secrets.delete('acme', 'model.key')).toBe(false)
      expect(await secrets.has('acme', 'model.key')).toBe(false)
      expect(await secrets.get('acme', 'model.key')).toBeUndefined()
   })

   it('refuses malformed names and values', async () => {
      const { secrets } = build()

      await expect(secrets.set('acme', 'Model Key', 'value')).rejects.toThrow(InvalidTenantError)
      await expect(secrets.set('acme', '', 'value')).rejects.toThrow(InvalidTenantError)
      await expect(secrets.set('acme', 'model.key', '')).rejects.toThrow(InvalidTenantError)
      await expect(secrets.set('', 'model.key', 'value')).rejects.toThrow(InvalidTenantError)
   })
})
