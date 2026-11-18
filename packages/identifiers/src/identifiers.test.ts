import { InvalidIdentifierError, assertOpaqueId, assertSlug, isOpaqueId, isPrefixedId, isSlug, isUri, isUuid, prefixedId, slugify, uniqueSlug, uuid } from './index'

describe('slugs', () => {
   it('recognises slugs', () => {
      for (const slug of ['a', 'acme', 'acme-2', '2026-report', 'a'.repeat(63)]) {
         expect(isSlug(slug)).toBe(true)
      }
      for (const value of ['', 'Acme', 'a b', '-a', 'a-', 'a_b', '../etc', 'a'.repeat(64), 12, null, undefined]) {
         expect(isSlug(value)).toBe(false)
      }
      expect(() => assertSlug('Not A Slug', 'A space name')).toThrow(/^A space name is 1 to 63/)
      expect(() => assertSlug('fine')).not.toThrow()
   })

   it('derives a slug from free text', () => {
      expect(slugify('  Maintenance Guide — Édition 2026 (v2)  ')).toBe('maintenance-guide-edition-2026-v2')
      expect(slugify('Straße & Œuvre / Ærø')).toBe('strasse-oeuvre-aero')
      expect(slugify('__already--slugged__')).toBe('already-slugged')
      expect(slugify('日本語')).toBe('')
      expect(slugify('')).toBe('')
      expect(isSlug(slugify('Any Title, Really!'))).toBe(true)
   })

   it('respects the length limit without leaving a trailing hyphen', () => {
      expect(slugify('alpha beta gamma', { maxLength: 11 })).toBe('alpha-beta')
      expect(slugify('x'.repeat(200))).toHaveLength(63)
      expect(() => slugify('a', { maxLength: 64 })).toThrow(InvalidIdentifierError)
      expect(() => slugify('a', { maxLength: 0 })).toThrow(InvalidIdentifierError)
      expect(() => slugify(42 as never)).toThrow(InvalidIdentifierError)
   })

   it('finds a free slug with a counter', async () => {
      const taken = new Set(['report', 'report-2'])
      expect(await uniqueSlug('report', (candidate) => taken.has(candidate))).toBe('report-3')
      expect(await uniqueSlug('fresh', async () => false)).toBe('fresh')
      const long = 'a'.repeat(63)
      const second = await uniqueSlug(long, (candidate) => candidate === long)
      expect(second).toBe(`${'a'.repeat(61)}-2`)
      await expect(uniqueSlug('report', () => true, { maxAttempts: 3 })).rejects.toThrow(/after 3 attempts/)
      await expect(uniqueSlug('Not A Slug', () => false)).rejects.toBeInstanceOf(InvalidIdentifierError)
   })
})

describe('identifiers', () => {
   it('generates and recognises UUIDs', () => {
      expect(isUuid(uuid())).toBe(true)
      expect(isUuid('018F4C5A-7B2E-7C3D-9A1B-2C3D4E5F6A7B')).toBe(true)
      for (const value of ['', 'not-a-uuid', '018f4c5a7b2e7c3d9a1b2c3d4e5f6a7b', '00000000-0000-0000-0000-000000000000', 7]) {
         expect(isUuid(value)).toBe(false)
      }
   })

   it('generates prefixed identifiers', () => {
      const id = prefixedId('doc')
      expect(id).toMatch(/^doc_[0-9a-z]{25}$/)
      expect(isPrefixedId(id)).toBe(true)
      expect(isPrefixedId(id, 'doc')).toBe(true)
      expect(isPrefixedId(id, 'usr')).toBe(false)
      expect(isPrefixedId('doc_short')).toBe(false)
      expect(isPrefixedId(id.toUpperCase())).toBe(false)
      expect(new Set(Array.from({ length: 500 }, () => prefixedId('x'))).size).toBe(500)
      for (const prefix of ['', 'Doc', '1doc', 'doc_', 'a'.repeat(17)]) {
         expect(() => prefixedId(prefix)).toThrow(InvalidIdentifierError)
      }
   })

   it('accepts opaque identifiers without control characters', () => {
      expect(isOpaqueId('auth0|64f1')).toBe(true)
      expect(isOpaqueId('user@example.org')).toBe(true)
      for (const value of ['', 'a\nb', 'a\u0000b', 'x'.repeat(201), 5, undefined]) {
         expect(isOpaqueId(value)).toBe(false)
      }
      expect(() => assertOpaqueId('', 'A user identifier')).toThrow(/^A user identifier must be/)
   })
})

describe('isUri', () => {
   it('accepts absolute URIs and filters schemes', () => {
      expect(isUri('https://example.org/a?b=1')).toBe(true)
      expect(isUri('okf:guides/maintenance')).toBe(true)
      expect(isUri('https://example.org', ['https'])).toBe(true)
      expect(isUri('HTTPS://example.org', ['https'])).toBe(true)
      expect(isUri('javascript:alert(1)', ['http', 'https'])).toBe(false)
      expect(isUri('file:///etc/passwd', ['https'])).toBe(false)
      for (const value of ['', '/relative/path', 'example.org', 'https://exa mple.org', ' https://example.org', 3]) {
         expect(isUri(value)).toBe(false)
      }
   })
})
