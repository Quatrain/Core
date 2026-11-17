import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { InvalidTenantError, SecretUnreadableError } from './errors'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const NONCE_BYTES = 12
const TAG_BYTES = 16
/** Prefix of a sealed value; names the format, so it can evolve. */
const FORMAT = 'v1'

/**
 * What a sealed value is bound to: it only opens for the tenant and the name it was sealed for.
 */
export interface SecretContextInterface {
   tenant: string
   name: string
}

/**
 * Seals and opens secret values with AES-256-GCM under a key held by the host application.
 *
 * A sealed value is authenticated together with its context, so a value copied to another
 * tenant or another name, or altered in the store, does not open.
 */
export class SecretSealer {
   protected readonly key: Buffer

   /**
    * @param key - 256-bit key: a 32-byte buffer, or its base64 encoding.
    * @throws InvalidTenantError when the key is not exactly 32 bytes.
    */
   constructor(key: Buffer | string) {
      const bytes = typeof key === 'string' ? Buffer.from(key, 'base64') : Buffer.from(key)
      if (bytes.length !== KEY_BYTES) {
         throw new InvalidTenantError(`A sealing key is ${KEY_BYTES} bytes long (base64 encoded when given as text).`)
      }
      this.key = bytes
   }

   /**
    * Seals a value.
    *
    * @param value - Clear value.
    * @param context - Tenant and name the value belongs to.
    * @returns The sealed value, as text safe to store.
    */
   seal(value: string, context: SecretContextInterface): string {
      const nonce = randomBytes(NONCE_BYTES)
      const cipher = createCipheriv(ALGORITHM, this.key, nonce)
      cipher.setAAD(SecretSealer.bind(context))
      const sealed = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
      return [FORMAT, nonce.toString('base64url'), cipher.getAuthTag().toString('base64url'), sealed.toString('base64url')].join('.')
   }

   /**
    * Opens a sealed value.
    *
    * @param sealed - Value returned by `seal`.
    * @param context - Tenant and name the value is read for.
    * @returns The clear value.
    * @throws SecretUnreadableError when the value is malformed, was altered, was sealed for
    *    another tenant or name, or under another key. The message never carries the value.
    */
   open(sealed: string, context: SecretContextInterface): string {
      const parts = typeof sealed === 'string' ? sealed.split('.') : []
      if (parts.length !== 4 || parts[0] !== FORMAT) {
         throw new SecretUnreadableError(context)
      }
      const nonce = Buffer.from(parts[1], 'base64url')
      const tag = Buffer.from(parts[2], 'base64url')
      if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) {
         throw new SecretUnreadableError(context)
      }
      try {
         const decipher = createDecipheriv(ALGORITHM, this.key, nonce)
         decipher.setAAD(SecretSealer.bind(context))
         decipher.setAuthTag(tag)
         return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8')
      } catch {
         throw new SecretUnreadableError(context)
      }
   }

   /**
    * Bytes authenticated with the value. Lengths are part of it, so that no two contexts
    * produce the same bytes.
    */
   protected static bind(context: SecretContextInterface): Buffer {
      return Buffer.from(JSON.stringify([context.tenant, context.name]), 'utf8')
   }
}
