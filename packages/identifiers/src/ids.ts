import { randomBytes, randomUUID } from 'node:crypto'
import { InvalidIdentifierError } from './errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PREFIX = /^[a-z][a-z0-9]{0,15}$/
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
/** 25 characters of base 36 carry about 129 random bits. */
const RANDOM_LENGTH = 25
const PREFIXED = new RegExp(`^([a-z][a-z0-9]{0,15})_([0-9a-z]{${RANDOM_LENGTH}})$`)
const MAX_OPAQUE_LENGTH = 200

/**
 * @returns A random version 4 UUID.
 */
export function uuid(): string {
   return randomUUID()
}

/**
 * @param value - Candidate UUID.
 * @returns True for a UUID of version 1 to 8, in either letter case.
 */
export function isUuid(value: unknown): value is string {
   return typeof value === 'string' && UUID.test(value)
}

/**
 * Generates an identifier that says what it identifies: `usr_3x9…`, `doc_k2p…`.
 * The random part carries as many bits as a UUID, in lower-case base 36: safe in URLs, file names
 * and case-insensitive systems.
 *
 * @param prefix - Kind of object: a lower-case letter then up to 15 letters or digits.
 * @returns `<prefix>_<25 characters>`.
 * @throws InvalidIdentifierError when the prefix is malformed.
 */
export function prefixedId(prefix: string): string {
   if (typeof prefix !== 'string' || !PREFIX.test(prefix)) {
      throw new InvalidIdentifierError('An identifier prefix is a lower-case letter followed by up to 15 lower-case letters or digits.')
   }
   let random = ''
   while (random.length < RANDOM_LENGTH) {
      for (const byte of randomBytes(RANDOM_LENGTH)) {
         // 252 is the largest multiple of 36 below 256: higher bytes are dropped to keep the draw uniform.
         if (byte < 252 && random.length < RANDOM_LENGTH) {
            random += ALPHABET[byte % 36]
         }
      }
   }
   return `${prefix}_${random}`
}

/**
 * @param value - Candidate identifier.
 * @param prefix - Expected prefix; any well-formed prefix when omitted.
 * @returns True when the value was shaped by {@link prefixedId}.
 */
export function isPrefixedId(value: unknown, prefix?: string): value is string {
   if (typeof value !== 'string') {
      return false
   }
   const match = PREFIXED.exec(value)
   return match !== null && (prefix === undefined || match[1] === prefix)
}

/**
 * Tells whether a value can be stored and compared as an identifier issued by another system
 * (a user id from an identity provider, a foreign key): a non-empty string of at most 200
 * characters without control characters. It says nothing about the format.
 *
 * @param value - Candidate identifier.
 * @returns True when the value is acceptable.
 */
export function isOpaqueId(value: unknown): value is string {
   // eslint-disable-next-line no-control-regex
   return typeof value === 'string' && value.length > 0 && value.length <= MAX_OPAQUE_LENGTH && !/[\u0000-\u001f\u007f]/.test(value)
}

/**
 * @param value - Candidate identifier.
 * @param label - Name used in the error message.
 * @throws InvalidIdentifierError when the value is not acceptable.
 */
export function assertOpaqueId(value: unknown, label = 'An identifier'): asserts value is string {
   if (!isOpaqueId(value)) {
      throw new InvalidIdentifierError(`${label} must be a non-empty string of at most ${MAX_OPAQUE_LENGTH} characters without control characters.`)
   }
}
