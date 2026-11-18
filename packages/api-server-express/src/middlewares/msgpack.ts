import express, { NextFunction, Request, RequestHandler, Response } from 'express'
import { decode, encode } from '@msgpack/msgpack'
import { ObjectUri } from '@quatrain/core'

/** Canonical MessagePack content type. */
export const MSGPACK_CONTENT_TYPE = 'application/x-msgpack'

/** Content types recognized as MessagePack (request body and `Accept` header). */
export const MSGPACK_ALIASES = [MSGPACK_CONTENT_TYPE, 'application/msgpack']

const JSON_REFERENCE_KEYS = ['ref', 'label', 'backend', 'uri']

const isEncodable = (value: unknown): boolean =>
   value !== null &&
   value !== undefined &&
   typeof value !== 'function' &&
   typeof value !== 'symbol'

/**
 * Detects an `ObjectUri` reference already serialized by `toJSON()` / `toReference()`
 * (`{ ref, label, backend?, uri? }`), as returned by handlers calling `.toJSON()` before sending.
 */
const isJsonReference = (value: Record<string, unknown>): boolean =>
   typeof value.ref === 'string' &&
   Object.keys(value).every((key) => JSON_REFERENCE_KEYS.includes(key))

/**
 * Recursively normalizes a value before MessagePack encoding:
 * 1. Objects implementing `toMsgPack()` (`ObjectUri`, `DataObject`, `AbstractObject`) are converted with it,
 *    otherwise objects implementing `toJSON()` (e.g. `Date`) are converted with it.
 * 2. References already serialized as `{ ref, label }` get `path` instead of `ref`
 *    (`ref` is a reserved keyword in C#).
 * 3. `null`, `undefined`, function and symbol values are omitted (object keys and array items),
 *    as are circular references: MessagePack clients never receive `null`.
 * 4. `Buffer` / `Uint8Array` values are preserved; unsafe `bigint` values become strings.
 *
 * @param value - Value to normalize.
 * @param seen - Ancestors being normalized, used to detect circular references.
 * @returns The value ready for `encode()`.
 */
export const normalizeForMsgpack = (
   value: unknown,
   seen: WeakSet<object> = new WeakSet<object>()
): unknown => {
   if (value === null || value === undefined) {
      return undefined
   }

   if (typeof value === 'bigint') {
      const asNumber = Number(value)
      return Number.isSafeInteger(asNumber) ? asNumber : value.toString()
   }

   if (typeof value !== 'object' || Buffer.isBuffer(value) || value instanceof Uint8Array) {
      return value
   }

   if (seen.has(value)) {
      return undefined
   }

   seen.add(value)
   try {
      for (const method of ['toMsgPack', 'toJSON'] as const) {
         const fn = (value as Record<string, unknown>)[method]
         if (typeof fn === 'function') {
            const converted = fn.call(value)
            if (converted !== value) {
               return normalizeForMsgpack(converted, seen)
            }
         }
      }

      if (Array.isArray(value)) {
         return value.map((item) => normalizeForMsgpack(item, seen)).filter(isEncodable)
      }

      let source = value as Record<string, unknown>
      if (isJsonReference(source)) {
         source = ObjectUri.toMsgPackReference(source)
      }

      const normalized: Record<string, unknown> = {}
      for (const [key, propVal] of Object.entries(source)) {
         const normalizedProp = normalizeForMsgpack(propVal, seen)
         if (isEncodable(normalizedProp)) {
            normalized[key] = normalizedProp
         }
      }
      return normalized
   } finally {
      seen.delete(value)
   }
}

/**
 * Normalizes and encodes a value as a MessagePack `Buffer`.
 *
 * @param value - Value to encode.
 * @returns Binary MessagePack payload.
 */
export const encodeMsgpack = (value: unknown): Buffer => {
   const encoded = encode(normalizeForMsgpack(value))
   return Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength)
}

/**
 * Tells whether the client asked for a MessagePack response,
 * through `?format=msgpack` or the `Accept` header.
 *
 * @param req - Incoming request.
 * @returns `true` when MessagePack is requested.
 */
export const isMsgpackRequested = (req: Request): boolean => {
   const format = Array.isArray(req.query?.format) ? req.query.format[0] : req.query?.format
   if (typeof format === 'string' && format.toLowerCase() === 'msgpack') {
      return true
   }

   const accept = req.headers?.accept
   if (typeof accept === 'string') {
      const lower = accept.toLowerCase()
      return MSGPACK_ALIASES.some((alias) => lower.includes(alias))
   }

   return false
}

/**
 * Bidirectional MessagePack content negotiation:
 * 1. Decodes MessagePack request bodies into `req.body`
 *    (requires a raw body parser for `MSGPACK_ALIASES`, e.g. `express.raw({ type: MSGPACK_ALIASES })`).
 * 2. Encodes `res.json()` / `res.send()` payloads as MessagePack when the client asks for it.
 */
export const msgpackContentNegotiation: RequestHandler = (
   req: Request,
   res: Response,
   next: NextFunction
): void => {
   const contentType = req.headers['content-type']?.toLowerCase() || ''
   if (MSGPACK_ALIASES.some((alias) => contentType.includes(alias)) && Buffer.isBuffer(req.body)) {
      try {
         req.body = req.body.length > 0 ? decode(req.body) : {}
      } catch (err: unknown) {
         const message = err instanceof Error ? err.message : 'Malformed payload'
         res.status(400).json({ error: `Invalid MessagePack payload: ${message}` })
         return
      }
   }

   if (isMsgpackRequested(req)) {
      const originalJson = res.json.bind(res)
      const originalSend = res.send.bind(res)

      const sendMsgpack = (data: unknown): Response => {
         try {
            const buffer = encodeMsgpack(data)
            res.setHeader('Content-Type', MSGPACK_CONTENT_TYPE)
            return originalSend(buffer)
         } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Serialization error'
            res.status(500)
            res.setHeader('Content-Type', 'application/json')
            return originalJson({ error: `Failed to serialize MessagePack response: ${message}` })
         }
      }

      res.json = sendMsgpack
      res.send = (data?: unknown): Response =>
         data === undefined || Buffer.isBuffer(data) || typeof data === 'string'
            ? originalSend(data)
            : sendMsgpack(data)
   }

   next()
}

/**
 * Express middlewares enabling MessagePack on an app or router:
 * raw body parser for MessagePack requests, then content negotiation.
 *
 * @param limit - Maximum request body size (default `50mb`).
 * @returns Middlewares to pass to `app.use()`.
 */
export const msgpackMiddlewares = (limit = '50mb'): RequestHandler[] => {
   return [express.raw({ type: MSGPACK_ALIASES, limit }), msgpackContentNegotiation]
}
