import { MsgPackOptions, ObjectUri } from '@quatrain/types'

/**
 * Normalizes any value into its MessagePack wire representation, ready to be handed to a
 * MessagePack encoder. This is the single place where the wire contract is enforced, whatever
 * produced the value (live objects, payloads already serialized with `toJSON()`, plain literals):
 *
 * 1. Objects implementing `toMsgPack()` are converted with it (it receives `options`), otherwise
 *    objects implementing `toJSON()` (e.g. `Date`) are converted with it. The result is normalized
 *    again, so a conversion method never has to enforce the rules below itself.
 * 2. At every depth, a `ref` key is emitted as `path` (see `ObjectUri.toMsgPackReference()`):
 *    `ref` is a reserved keyword in several client languages. This rule is on by default and is
 *    turned off with `options.refAsPath = false`.
 * 3. `null`, `undefined`, function and symbol values are omitted (object keys, array and set items),
 *    as are circular references: MessagePack clients never receive `null`.
 * 4. Binary views (`Uint8Array`, `Buffer`...) are preserved, an `ArrayBuffer` becomes a `Uint8Array`.
 * 5. `Map` instances become plain objects, `Set` instances become arrays.
 * 6. `bigint` values become numbers when safe, strings otherwise.
 *
 * @param value - Value to normalize.
 * @param options - Wire representation options (`refAsPath`, default `true`).
 * @param seen - Ancestors being normalized, used to detect circular references.
 * @returns The normalized value, or `undefined` when the value must be omitted.
 */
export const normalizeForMsgPack = (
   value: unknown,
   options: MsgPackOptions = {},
   seen: WeakSet<object> = new WeakSet<object>()
): unknown => {
   if (value === null || value === undefined) {
      return undefined
   }

   if (typeof value === 'function' || typeof value === 'symbol') {
      return undefined
   }

   if (typeof value === 'bigint') {
      const asNumber = Number(value)
      return Number.isSafeInteger(asNumber) ? asNumber : value.toString()
   }

   if (typeof value !== 'object') {
      return value
   }

   if (ArrayBuffer.isView(value)) {
      return value
   }

   if (value instanceof ArrayBuffer) {
      return new Uint8Array(value)
   }

   if (seen.has(value)) {
      return undefined
   }

   seen.add(value)
   try {
      for (const method of ['toMsgPack', 'toJSON'] as const) {
         const convert: unknown = (value as Record<string, unknown>)[method]
         if (typeof convert === 'function') {
            const converted: unknown =
               method === 'toMsgPack' ? convert.call(value, options) : convert.call(value)
            if (converted !== value) {
               return normalizeForMsgPack(converted, options, seen)
            }
         }
      }

      if (Array.isArray(value) || value instanceof Set) {
         return normalizeItems([...value], options, seen)
      }

      const entries =
         value instanceof Map
            ? [...value.entries()].map(([key, item]): [string, unknown] => [String(key), item])
            : Object.entries(value)

      return normalizeEntries(entries, options, seen)
   } finally {
      seen.delete(value)
   }
}

/**
 * Normalizes the items of a list, omitting those that cannot be encoded.
 *
 * @param items - Items to normalize.
 * @param options - Wire representation options.
 * @param seen - Ancestors being normalized.
 * @returns The normalized items.
 */
const normalizeItems = (
   items: unknown[],
   options: MsgPackOptions,
   seen: WeakSet<object>
): unknown[] => {
   return items
      .map((item) => normalizeForMsgPack(item, options, seen))
      .filter((item) => item !== undefined)
}

/**
 * Normalizes the entries of a dictionary: applies the `ref` to `path` rule unless it is turned off,
 * then omits the values that cannot be encoded.
 *
 * @param entries - Key/value pairs to normalize.
 * @param options - Wire representation options.
 * @param seen - Ancestors being normalized.
 * @returns The normalized dictionary.
 */
const normalizeEntries = (
   entries: [string, unknown][],
   options: MsgPackOptions,
   seen: WeakSet<object>
): Record<string, unknown> => {
   const dictionary: Record<string, unknown> = Object.fromEntries(entries)
   const source: Record<string, unknown> =
      options.refAsPath === false ? dictionary : ObjectUri.toMsgPackReference(dictionary)

   const normalized: Record<string, unknown> = {}
   for (const [key, item] of Object.entries(source)) {
      const normalizedItem = normalizeForMsgPack(item, options, seen)
      if (normalizedItem !== undefined) {
         normalized[key] = normalizedItem
      }
   }

   return normalized
}
