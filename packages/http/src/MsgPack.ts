import { decode, encode } from '@msgpack/msgpack'
import { normalizeForMsgPack } from '@quatrain/core'
import { HttpHeader } from './HttpHeader'
import { HttpStatus } from './HttpStatus'

/** Canonical MessagePack content type. */
export const MSGPACK_CONTENT_TYPE = 'application/x-msgpack'

/** Content types recognized as MessagePack (request body and `Accept` header). */
export const MSGPACK_CONTENT_TYPES = [MSGPACK_CONTENT_TYPE, 'application/msgpack']

/**
 * Minimal request shape needed for MessagePack content negotiation.
 * Structurally compatible with Node.js based frameworks (Express, Connect...).
 */
export interface MsgPackRequest {
   /** Lower-cased request headers. */
   headers: Record<string, string | string[] | undefined>
   /** Parsed query string parameters. */
   query?: Record<string, unknown>
   /** Request body: the raw `Buffer` for MessagePack requests, replaced by the decoded value. */
   body?: any
}

/**
 * Minimal response shape needed for MessagePack content negotiation.
 * Structurally compatible with Node.js based frameworks (Express, Connect...).
 */
export interface MsgPackResponse {
   /** Sets a response header. */
   setHeader(name: string, value: string): unknown
   /** Sets the response status code. */
   status(code: number): unknown
   /** Sends a JSON payload. */
   json(body?: any): any
   /** Sends a payload. */
   send(body?: any): any
}

const includesMsgPackContentType = (header: string): boolean => {
   const lower = header.toLowerCase()
   return MSGPACK_CONTENT_TYPES.some((contentType) => lower.includes(contentType))
}

const firstValue = (value: unknown): unknown => {
   return Array.isArray(value) ? value[0] : value
}

/**
 * Tells whether the client asked for a MessagePack response,
 * through `?format=msgpack` or the `Accept` header.
 *
 * @param req - Incoming request.
 * @returns `true` when MessagePack is requested.
 */
export const isMsgPackRequested = (req: MsgPackRequest): boolean => {
   const format = firstValue(req.query?.format)
   if (typeof format === 'string' && format.toLowerCase() === 'msgpack') {
      return true
   }

   const accept = req.headers?.accept
   const acceptValue = Array.isArray(accept) ? accept.join(',') : accept

   return typeof acceptValue === 'string' && includesMsgPackContentType(acceptValue)
}

/**
 * Encodes a value as a MessagePack `Buffer`.
 * The value is first normalized by `normalizeForMsgPack()`: the MessagePack wire contract
 * is owned by `@quatrain/core`, this HTTP layer only negotiates and encodes.
 *
 * @param value - Value to encode.
 * @returns Binary MessagePack payload.
 */
export const encodeMsgPack = (value: unknown): Buffer => {
   const encoded = encode(normalizeForMsgPack(value))
   return Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength)
}

/**
 * Bidirectional MessagePack content negotiation, as a framework-agnostic middleware:
 * 1. Decodes MessagePack request bodies into `req.body`. The body must have been read as a raw
 *    `Buffer` beforehand (e.g. `express.raw({ type: MSGPACK_CONTENT_TYPES })`).
 * 2. Encodes `res.json()` / `res.send()` payloads as MessagePack when the client asks for it.
 *    Strings and buffers passed to `res.send()` are sent untouched.
 *
 * @param req - Incoming request.
 * @param res - Outgoing response.
 * @param next - Callback handing over to the next middleware.
 */
export const msgPackContentNegotiation = (
   req: MsgPackRequest,
   res: MsgPackResponse,
   next: () => void
): void => {
   const contentType = firstValue(req.headers?.['content-type'])
   const isMsgPackBody = typeof contentType === 'string' && includesMsgPackContentType(contentType)

   if (isMsgPackBody && Buffer.isBuffer(req.body)) {
      try {
         req.body = req.body.length > 0 ? decode(req.body) : {}
      } catch (err: unknown) {
         const message = err instanceof Error ? err.message : 'Malformed payload'
         res.status(HttpStatus.BAD_REQUEST)
         res.json({ error: `Invalid MessagePack payload: ${message}` })
         return
      }
   }

   if (isMsgPackRequested(req)) {
      const originalJson = res.json.bind(res)
      const originalSend = res.send.bind(res)

      const sendMsgPack = (data: unknown): unknown => {
         let buffer: Buffer
         try {
            buffer = encodeMsgPack(data)
         } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Serialization error'
            res.status(HttpStatus.INTERNAL_SERVER_ERROR)
            return originalJson({ error: `Failed to serialize MessagePack response: ${message}` })
         }

         res.setHeader(HttpHeader.CONTENT_TYPE, MSGPACK_CONTENT_TYPE)
         return originalSend(buffer)
      }

      res.json = sendMsgPack
      res.send = (data?: unknown): unknown => {
         if (data === undefined || Buffer.isBuffer(data) || typeof data === 'string') {
            return originalSend(data)
         }
         return sendMsgPack(data)
      }
   }

   next()
}
