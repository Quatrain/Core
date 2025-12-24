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
