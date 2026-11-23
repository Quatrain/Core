import { ObjectUri } from '@quatrain/types'
import { normalizeForMsgPack } from './msgpack'

/**
 * Collects every key found at any depth of a normalized value.
 *
 * @param value - Normalized value to inspect.
 * @returns All keys, in traversal order.
 */
const collectKeys = (value: unknown): string[] => {
   if (Array.isArray(value)) {
      return value.flatMap(collectKeys)
   }
   if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
      return Object.entries(value).flatMap(([key, item]) => [key, ...collectKeys(item)])
   }
   return []
}

describe('normalizeForMsgPack()', () => {
   describe('ref to path rule', () => {
      it('serializes ObjectUri instances via toMsgPack()', () => {
         const company = new ObjectUri('companies/c1', 'Acme')

         expect(normalizeForMsgPack({ company })).toEqual({
            company: { path: 'companies/c1', label: 'Acme' },
         })
      })

      it('renames ref on references already serialized via toJSON() or toReference()', () => {
         const owner = new ObjectUri('users/u2', 'Bob')

         expect(
            normalizeForMsgPack({
               company: { ref: 'companies/c1', label: 'Acme' },
               createdBy: { ref: 'users/u1', label: 'Alice', backend: '@pg' },
               owner: owner.toReference(),
               updatedBy: owner.toJSON(),
            })
         ).toEqual({
            company: { path: 'companies/c1', label: 'Acme' },
            createdBy: { path: 'users/u1', label: 'Alice', backend: '@pg' },
            owner: { path: 'users/u2', uri: '', label: 'Bob' },
            updatedBy: { path: 'users/u2', label: 'Bob' },
         })
      })

      it('renames ref on references enriched with extra keys', () => {
         expect(
            normalizeForMsgPack({ ref: 'users/u1', label: 'Alice', email: 'alice@example.org', age: 30 })
         ).toEqual({ path: 'users/u1', label: 'Alice', email: 'alice@example.org', age: 30 })
      })

      it('renames ref whatever its value type', () => {
         expect(normalizeForMsgPack({ ref: 42 })).toEqual({ path: 42 })
         expect(normalizeForMsgPack({ ref: { ref: 'users/u1' } })).toEqual({
            path: { path: 'users/u1' },
         })
      })

      it('renames ref at every depth, in arrays, maps and sets', () => {
         const payload = {
            items: [
               { uid: 'v1', company: { ref: 'companies/c1', label: 'Acme' } },
               { uid: 'v2', shares: [{ ref: 'users/u1' }, { ref: 'users/u2' }] },
            ],
            byKey: new Map([['main', { ref: 'sites/s1' }]]),
            unique: new Set([{ ref: 'sites/s2' }]),
            deep: { a: { b: { c: [{ d: { ref: 'docs/d1' } }] } } },
         }

         const normalized = normalizeForMsgPack(payload)

         expect(collectKeys(normalized)).not.toContain('ref')
         expect(normalized).toEqual({
            items: [
               { uid: 'v1', company: { path: 'companies/c1', label: 'Acme' } },
               { uid: 'v2', shares: [{ path: 'users/u1' }, { path: 'users/u2' }] },
            ],
            byKey: { main: { path: 'sites/s1' } },
            unique: [{ path: 'sites/s2' }],
            deep: { a: { b: { c: [{ d: { path: 'docs/d1' } }] } } },
         })
      })

      it('renames ref in the output of toMsgPack() and toJSON() conversion methods', () => {
         const viaMsgPack = { toMsgPack: () => ({ parent: { ref: 'sites/s1' } }) }
         const viaJson = { toJSON: () => ({ ref: 'sites/s2', children: [{ ref: 'sites/s3' }] }) }

         expect(normalizeForMsgPack({ viaMsgPack, viaJson })).toEqual({
            viaMsgPack: { parent: { path: 'sites/s1' } },
            viaJson: { path: 'sites/s2', children: [{ path: 'sites/s3' }] },
         })
      })

      it('prefers toMsgPack() over toJSON()', () => {
         const value = { toMsgPack: () => ({ from: 'msgpack' }), toJSON: () => ({ from: 'json' }) }

         expect(normalizeForMsgPack(value)).toEqual({ from: 'msgpack' })
      })

      it('keeps both keys when a dictionary already carries a path', () => {
         const value = { ref: 'refs/heads/main', path: 'src/index.ts' }

         expect(normalizeForMsgPack(value)).toEqual(value)
      })

      it('does not mutate the source value', () => {
         const source = { company: { ref: 'companies/c1', label: 'Acme' } }

         normalizeForMsgPack(source)

         expect(source).toEqual({ company: { ref: 'companies/c1', label: 'Acme' } })
      })
   })

   describe('omitted values', () => {
      it('omits null, undefined, function and symbol values in objects and lists', () => {
         expect(
            normalizeForMsgPack({
               name: 'x',
               empty: null,
               missing: undefined,
               fn: () => 1,
               sym: Symbol('s'),
               nested: { keep: 1, drop: null },
            })
         ).toEqual({ name: 'x', nested: { keep: 1 } })
         expect(normalizeForMsgPack([1, null, 2, undefined, 3])).toEqual([1, 2, 3])
         expect(normalizeForMsgPack(null)).toBeUndefined()
      })

      it('keeps falsy values that are not null', () => {
         expect(normalizeForMsgPack({ zero: 0, no: false, blank: '' })).toEqual({
            zero: 0,
            no: false,
            blank: '',
         })
      })

      it('omits circular references but keeps repeated siblings', () => {
         const shared = { ref: 'users/u1' }
         const node: Record<string, unknown> = { name: 'root', first: shared, second: shared }
         node.self = node

         expect(normalizeForMsgPack(node)).toEqual({
            name: 'root',
            first: { path: 'users/u1' },
            second: { path: 'users/u1' },
         })
      })
   })

   describe('special values', () => {
      it('converts dates via toJSON()', () => {
         expect(normalizeForMsgPack({ at: new Date('2026-11-09T18:49:23.823Z') })).toEqual({
            at: '2026-11-09T18:49:23.823Z',
         })
      })

      it('preserves binary views and wraps array buffers', () => {
         const bytes = new Uint8Array([1, 2, 3])
         const normalized = normalizeForMsgPack({ bytes, raw: bytes.buffer }) as Record<string, unknown>

         expect(normalized.bytes).toBe(bytes)
         expect(normalized.raw).toEqual(new Uint8Array([1, 2, 3]))
      })

      it('converts bigint values to numbers when safe, strings otherwise', () => {
         expect(normalizeForMsgPack({ small: 42n, big: 9007199254740993n })).toEqual({
            small: 42,
            big: '9007199254740993',
         })
      })
   })
})

describe('ObjectUri.toMsgPackReference()', () => {
   it('renames ref to path, keeping the other keys', () => {
      expect(ObjectUri.toMsgPackReference({ ref: 'users/u1', label: 'Alice', extra: true })).toEqual({
         path: 'users/u1',
         label: 'Alice',
         extra: true,
      })
   })

   it('returns non-references, arrays and dictionaries carrying a path untouched', () => {
      const withPath = { ref: 'a', path: 'b' }
      const list = [{ ref: 'a' }]

      expect(ObjectUri.toMsgPackReference('users/u1')).toBe('users/u1')
      expect(ObjectUri.toMsgPackReference(null)).toBeNull()
      expect(ObjectUri.toMsgPackReference({ name: 'x' })).toEqual({ name: 'x' })
      expect(ObjectUri.toMsgPackReference(withPath)).toBe(withPath)
      expect(ObjectUri.toMsgPackReference(list)).toBe(list)
   })
})
