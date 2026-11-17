import { HashProperty } from './HashProperty'

describe('Hash Property supports MD5 algorithm', () => {
   test('value is hashed with MD5', () => {
      const prop = new HashProperty({
         name: 'hash',
         algorithm: HashProperty.ALGORITHM_MD5,
      })
      expect(prop.set('azertyuiop').get()).toBe(
         '7682fe272099ea26efe39c890b33675b'
      )
   })
   test('prefix can be added', () => {
      const prop = new HashProperty({
         name: 'hash',
         algorithm: HashProperty.ALGORITHM_MD5,
         prefixed: true,
      })
      expect(prop.set('azertyuiop').get()).toBe(
         'md5-7682fe272099ea26efe39c890b33675b'
      )
   })
   test('salt can be added', () => {
      const prop = new HashProperty({
         name: 'hash',
         algorithm: HashProperty.ALGORITHM_MD5,
         salt: '123456',
      })
      expect(prop.set('azertyuiop').get()).toBe(
         '5560d200374e249898dcb68d5fa14117'
      )
   })
})

describe('Hash Property supports SHA1 algorithm', () => {
   test('value is hashed with SHA1 and optional salt', () => {
      const prop = new HashProperty({
         name: 'hash',
         algorithm: HashProperty.ALGORITHM_SHA1,
      })
      expect(prop.set('azertyuiop').get()).toBe(
         '58ad983135fe15c5a8e2e15fb5b501aedcf70dc2'
      )
   })
   test('prefix can be added', () => {
      const prop = new HashProperty({
         name: 'hash',
         algorithm: HashProperty.ALGORITHM_SHA1,
         prefixed: true,
      })
      expect(prop.set('azertyuiop').get()).toBe(
         'sha1-58ad983135fe15c5a8e2e15fb5b501aedcf70dc2'
      )
   })
   test('salt can be added', () => {
      const prop = new HashProperty({
         name: 'hash',
         algorithm: HashProperty.ALGORITHM_SHA1,
         salt: '123456',
      })
      expect(prop.set('azertyuiop').get()).toBe(
         '19ed93bb52146515d89fb3c223277b878fc0cd6c'
      )
   })
})

describe('Hash Property supports SHA256 algorithm', () => {
   test('value is hashed with SHA256 and optional salt', () => {
      const prop = new HashProperty({
         name: 'hash',
         algorithm: HashProperty.ALGORITHM_SHA256,
      })
      expect(prop.set('azertyuiop').get()).toBe(
         'aa3d2fe4f6d301dbd6b8fb2d2fddfb7aeebf3bec53ffff4b39a0967afa88c609'
      )
   })
   test('prefix can be added', () => {
      const prop = new HashProperty({
         name: 'hash',
         algorithm: HashProperty.ALGORITHM_SHA256,
         prefixed: true,
      })
      expect(prop.set('azertyuiop').get()).toBe(
         'sha256-aa3d2fe4f6d301dbd6b8fb2d2fddfb7aeebf3bec53ffff4b39a0967afa88c609'
      )
   })
   test('salt can be added', () => {
      const prop = new HashProperty({
         name: 'hash',
         algorithm: HashProperty.ALGORITHM_SHA256,
         salt: '123456',
      })
      expect(prop.set('azertyuiop').get()).toBe(
         'fd0142a229c2924d50c20576ac5850d9f3165f56d7630b62ad6e66a99bf5adc4'
      )
   })
})

describe('Hash Property allows comparison of string and hash value', () => {
   test('compare string with hash', () => {
      const prop = new HashProperty({
         name: 'hash',
         algorithm: HashProperty.ALGORITHM_SHA256,
      })
      expect(prop.set('azertyuiop').compare('azertyuiop')).toBe(true)
      expect(prop.set('azertyuiop').compare('qwertz')).toBe(false)
   })
})

describe('Hash Property Security Policies', () => {
   test('defaults to SHA256 when no algorithm is provided', () => {
      const prop = new HashProperty({
         name: 'my_hash',
      })
      expect(prop.set('azertyuiop').get()).toBe(
         'aa3d2fe4f6d301dbd6b8fb2d2fddfb7aeebf3bec53ffff4b39a0967afa88c609'
      )
   })

   test('throws error if MD5 is used for sensitive property names', () => {
      expect(() => {
         new HashProperty({
            name: 'userPassword',
            algorithm: HashProperty.ALGORITHM_MD5,
         })
      }).toThrow('SecurityError: Insecure hashing algorithm')

      expect(() => {
         new HashProperty({
            name: 'client_pwd',
            algorithm: HashProperty.ALGORITHM_MD5,
         })
      }).toThrow('SecurityError: Insecure hashing algorithm')
   })

   test('throws error if SHA1 is used for sensitive property names', () => {
      expect(() => {
         new HashProperty({
            name: 'secretToken',
            algorithm: HashProperty.ALGORITHM_SHA1,
         })
      }).toThrow('SecurityError: Insecure hashing algorithm')
   })

   test('allows SHA256 for sensitive property names', () => {
      const prop = new HashProperty({
         name: 'password',
         algorithm: HashProperty.ALGORITHM_SHA256,
      })
      expect(prop.set('azertyuiop').get()).toBe(
         'aa3d2fe4f6d301dbd6b8fb2d2fddfb7aeebf3bec53ffff4b39a0967afa88c609'
      )
   })
})

describe('Hash Property keeps values that must be read back (AES-256-GCM)', () => {
   const { randomBytes } = require('node:crypto')
   const { HashPropertyUnreadableError } = require('./HashProperty')
   const key = () => randomBytes(32)
   const sealing = (config: Record<string, unknown> = {}) =>
      new HashProperty({ name: 'apikey', algorithm: HashProperty.ALGORITHM_AES256GCM, ...config })

   afterEach(() => HashProperty.setDefaultKey(undefined))

   test('value is sealed, shown sealed, and read back', () => {
      const prop = sealing({ key: key() })
      prop.set('key-given-by-the-provider')

      expect(prop.reversible).toBe(true)
      expect(HashProperty.isSealed(prop.val())).toBe(true)
      expect(prop.val()).not.toContain('key-given')
      expect(JSON.stringify(prop)).not.toContain('key-given')
      expect(prop.reveal()).toBe('key-given-by-the-provider')
      expect(prop.compare('key-given-by-the-provider')).toBe(true)
      expect(prop.compare('another-key')).toBe(false)
   })

   test('the same value is sealed differently each time', () => {
      const shared = key()
      expect(sealing({ key: shared }).set('value').val()).not.toBe(sealing({ key: shared }).set('value').val())
   })

   test('key can be base64 text, a function, or set once for the process', () => {
      const bytes = key()
      const sealed = sealing({ key: bytes.toString('base64') }).set('value').val()

      expect(sealing({ key: () => bytes }).set(sealed).reveal()).toBe('value')
      HashProperty.setDefaultKey(bytes)
      expect(sealing().set(sealed).reveal()).toBe('value')
   })

   test('a value already sealed is stored as it is, as when loading an object', () => {
      const shared = key()
      const sealed = sealing({ key: shared }).set('value').val()
      const loaded = sealing({ key: shared })
      loaded.set(sealed, false)

      expect(loaded.val()).toBe(sealed)
      expect(loaded.reveal()).toBe('value')
   })

   test('a value does not read back under another key or for another context', () => {
      const shared = key()
      const sealed = sealing({ key: shared, context: 'account-1' }).set('value').val()

      expect(() => sealing({ key: key(), context: 'account-1' }).set(sealed).reveal()).toThrow(HashPropertyUnreadableError)
      expect(() => sealing({ key: shared, context: 'account-2' }).set(sealed).reveal()).toThrow(HashPropertyUnreadableError)
      expect(() => new HashProperty({ name: 'other', algorithm: HashProperty.ALGORITHM_AES256GCM, key: shared }).set(sealed).reveal()).toThrow(
         HashPropertyUnreadableError
      )
      expect(sealing({ key: shared, context: () => 'account-1' }).set(sealed).reveal()).toBe('value')
   })

   test('an altered value is refused and errors never carry a value', () => {
      const shared = key()
      const parts = sealing({ key: shared }).set('value').val().split('.')
      parts[4] = Buffer.from('other').toString('base64url')

      expect(() => sealing({ key: shared }).set(parts.join('.')).reveal()).toThrow(HashPropertyUnreadableError)
      expect(() => sealing({ key: shared }).set('aes-256-gcm.v1.broken').reveal()).toThrow(HashPropertyUnreadableError)
   })

   test('a missing or malformed key is refused', () => {
      expect(() => sealing().set('value')).toThrow(HashPropertyUnreadableError)
      expect(() => sealing({ key: randomBytes(16) }).set('value')).toThrow(HashPropertyUnreadableError)
      expect(() => sealing({ key: 'not a key' }).set('value')).toThrow(HashPropertyUnreadableError)
   })

   test('an empty property reveals nothing and one-way values cannot be read back', () => {
      expect(sealing({ key: key() }).reveal()).toBeUndefined()
      const digest = new HashProperty({ name: 'hash', algorithm: HashProperty.ALGORITHM_SHA256 })
      digest.set('value')
      expect(digest.reversible).toBe(false)
      expect(() => digest.reveal()).toThrow('cannot be read back')
   })
})
