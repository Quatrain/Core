import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { StringProperty, StringPropertyType } from './StringProperty'
import { Core } from '../Core'

export type HashPropertyAlgos =
   | typeof HashProperty.ALGORITHM_MD5
   | typeof HashProperty.ALGORITHM_SHA1
   | typeof HashProperty.ALGORITHM_SHA256
   | typeof HashProperty.ALGORITHM_BCRYPT
   | typeof HashProperty.ALGORITHM_AES256GCM

/** A 256-bit key: 32 bytes, or their base64 encoding, or a function returning either. */
export type HashPropertyKeyType = Buffer | string | (() => Buffer | string)

const KEY_BYTES = 32
const NONCE_BYTES = 12
const TAG_BYTES = 16
/** Start of every sealed value: the algorithm and the version of the layout. */
const SEALED_PREFIX = 'aes-256-gcm.v1.'

/**
 * Raised when a sealed value cannot be read back: altered, sealed under another key or for
 * another context, or no key is available. The message never carries the value.
 */
export class HashPropertyUnreadableError extends Error {
   constructor(property: string, reason: string) {
      super(`${property}: the value cannot be read back (${reason})`)
      this.name = 'HashPropertyUnreadableError'
   }
}

/**
 * Configuration dictionary for instantiating a `HashProperty`.
 * Extends `StringPropertyType` to add hashing capabilities.
 *
 * | Parameter | Type | Description | Default |
 * | :--- | :--- | :--- | :--- |
 * | `algorithm` | HashPropertyAlgos | The cryptographic hashing algorithm to use. | `ALGORITHM_SHA256` |
 * | `salt` | string | An optional salt string appended to the value before hashing. | `""` |
 * | `prefixed` | boolean | If true, prepends the algorithm name to the output (e.g. `md5-abc...`). | `false` |
 * | `key` | HashPropertyKeyType | Key of the reversible algorithm; the process-wide key when omitted. | - |
 * | `context` | string \| function | What a sealed value belongs to (an owner, a name); it only reads back for the same context. | property name |
 */
export interface HashPropertyType extends StringPropertyType {
   algorithm?: HashPropertyAlgos
   salt?: string
   prefixed?: boolean
   key?: HashPropertyKeyType
   context?: string | ((parent: unknown) => string)
}

/**
 * A specialized string property that automatically hashes incoming values before storing them.
 * Useful for storing passwords, secret tokens, or generating unique fingerprints.
 * Values set on this property are one-way hashed and cannot be reversed, except with the
 * reversible algorithm `ALGORITHM_AES256GCM`, meant for credentials the application must use
 * again (keys of a service, tokens): the value is sealed under a 256-bit key, only the sealed
 * text is stored and shown, and `reveal()` reads it back.
 * 
 * @example
 * ```typescript
 * const password = new HashProperty({
 *    name: 'password',
 *    algorithm: HashProperty.ALGORITHM_SHA256,
 *    salt: 'mySecretSalt'
 * });
 * 
 * password.set('mySuperPassword');
 * console.log(password.val()); // Returns the SHA256 hashed string
 * const isValid = password.compare('mySuperPassword'); // true
 *
 * HashProperty.setDefaultKey(process.env.SECRETS_KEY) // 32 bytes, base64: `openssl rand -base64 32`
 * const apiKey = new HashProperty({
 *    name: 'apikey',
 *    algorithm: HashProperty.ALGORITHM_AES256GCM,
 *    context: 'account-42', // the sealed value only reads back for this context
 * });
 * apiKey.set('key-given-by-the-provider');
 * apiKey.val();    // "aes-256-gcm.v1.…": what backends store
 * apiKey.reveal(); // "key-given-by-the-provider"
 * ```
 */
export class HashProperty extends StringProperty {
   /** The string literal type identifier for this property. */
   static TYPE = 'hash'
   /** Identifier for the MD5 hashing algorithm. */
   static ALGORITHM_MD5 = 'md5'
   /** Identifier for the SHA1 hashing algorithm. */
   static ALGORITHM_SHA1 = 'sha1'
   /** Identifier for the SHA256 hashing algorithm. */
   static ALGORITHM_SHA256 = 'sha256'
   /** Identifier for the BCRYPT hashing algorithm. */
   static ALGORITHM_BCRYPT = 'bcrypt'
   /** Identifier for the reversible AES-256-GCM sealing. */
   static ALGORITHM_AES256GCM = 'aes-256-gcm'

   protected static _defaultKey: HashPropertyKeyType | undefined

   /**
    * Sets the key used by reversible properties that name none, typically once at start-up.
    * Models declare their properties statically: this is how they receive a key held by the
    * environment.
    *
    * @param key - 32 bytes, their base64 encoding, or a function returning either; `undefined`
    *    removes the key.
    */
   static setDefaultKey(key: HashPropertyKeyType | undefined): void {
      HashProperty._defaultKey = key
   }

   /**
    * Tells whether a text is a value sealed by the reversible algorithm.
    *
    * @param value - Candidate.
    */
   static isSealed(value: unknown): value is string {
      return typeof value === 'string' && value.startsWith(SEALED_PREFIX)
   }

   protected _algorithm: HashPropertyAlgos
   protected _salt: string = ''
   protected _prefixed = false
   protected _key: HashPropertyKeyType | undefined
   protected _context: string | ((parent: unknown) => string) | undefined

   constructor(config: HashPropertyType) {
      super(config)
      this._key = config.key
      this._context = config.context
      this._algorithm = config.algorithm || HashProperty.ALGORITHM_SHA256
      this._salt = config.salt || ''
      this._prefixed = config.prefixed || false

      // Prevent legacy/insecure algorithms (MD5, SHA1) on sensitive properties
      if (
         this._algorithm === HashProperty.ALGORITHM_MD5 ||
         this._algorithm === HashProperty.ALGORITHM_SHA1
      ) {
         const sensitiveTerms = ['password', 'pwd', 'secret', 'token', 'credential']
         const nameLower = this._name.toLowerCase()
         const isSensitive = sensitiveTerms.some((term) => nameLower.includes(term))
         if (isSensitive) {
            throw new Error(
               `SecurityError: Insecure hashing algorithm "${this._algorithm}" cannot be used for sensitive property "${this._name}". Please use SHA256 or another secure algorithm.`
            )
         }
      }
   }

   /**
    * Internal method to perform the cryptographic hash on a raw string.
    * Uses Node.js native crypto module.
    * 
    * @param value - The raw string to hash.
    * @returns The hexadecimal representation of the hashed string.
    * @throws {Error} If the chosen algorithm is unsupported.
    */
   _hash(value: string): string {
      if (this.reversible) {
         return this._seal(value)
      }
      let algo
      switch (this._algorithm) {
         case HashProperty.ALGORITHM_MD5:
            algo = createHash('md5')
            Core.warn(
               `HashProperty: MD5 is deprecated for security reasons`
            )
            break

         case HashProperty.ALGORITHM_SHA1:
            algo = createHash('sha1')
            Core.warn(
               `HashProperty: SHA1 is deprecated for security reasons`
            )
            break

         case HashProperty.ALGORITHM_SHA256:
            algo = createHash('sha256')
            break

         default:
            throw new Error(
               `Unsupported or missing hash algorithm: ${this._algorithm}`
            )
      }

      let hash = this._prefixed ? `${this._algorithm}-` : ''
      hash += algo.update(`${this._salt}${value}`).digest('hex')

      this._rawValue = false // don't test some constraints after hashing

      return hash
   }

   /**
    * Hashes the provided value and stores the hashed result.
    * String length constraints (from StringProperty) are bypassed after hashing.
    * 
    * @param value - The raw cleartext string to hash and store.
    * @param setChanged - Whether to mark the property as modified.
    * @returns The property instance for chaining.
    */
   set(value: string, setChanged = true) {
      if (this.reversible && (value === null || value === undefined || HashProperty.isSealed(value))) {
         // Already sealed (an object loaded from a backend) or cleared: stored as it is
         this._rawValue = false
         return super.set(value, setChanged)
      }
      return super.set(this._hash(value), setChanged)
   }

   /** Whether the value can be read back with `reveal()`. */
   get reversible(): boolean {
      return this._algorithm === HashProperty.ALGORITHM_AES256GCM
   }

   /**
    * Reads back the clear value of a reversible property.
    *
    * @returns The clear value, or `undefined` when the property holds none.
    * @throws {Error} If the algorithm is one-way.
    * @throws {HashPropertyUnreadableError} If the stored value was altered, or sealed under
    *    another key or for another context, or no key is available.
    */
   reveal(): string | undefined {
      if (!this.reversible) {
         throw new Error(`${this._name}: values hashed with "${this._algorithm}" cannot be read back`)
      }
      if (this._value === undefined || this._value === null) {
         return undefined
      }
      const parts = HashProperty.isSealed(this._value) ? this._value.slice(SEALED_PREFIX.length).split('.') : []
      if (parts.length !== 3) {
         throw new HashPropertyUnreadableError(this._name, 'not a sealed value')
      }
      const nonce = Buffer.from(parts[0], 'base64url')
      const tag = Buffer.from(parts[1], 'base64url')
      if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) {
         throw new HashPropertyUnreadableError(this._name, 'not a sealed value')
      }
      const key = this._resolveKey()
      try {
         const decipher = createDecipheriv('aes-256-gcm', key, nonce)
         decipher.setAAD(this._resolveContext())
         decipher.setAuthTag(tag)
         return Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64url')), decipher.final()]).toString('utf8')
      } catch {
         throw new HashPropertyUnreadableError(this._name, 'altered, or sealed under another key or for another context')
      }
   }

   /**
    * Seals a clear value: a fresh nonce each time, the context authenticated with the value.
    *
    * @param value - Clear value.
    * @returns The sealed text.
    */
   protected _seal(value: string): string {
      const nonce = randomBytes(NONCE_BYTES)
      const cipher = createCipheriv('aes-256-gcm', this._resolveKey(), nonce)
      cipher.setAAD(this._resolveContext())
      const sealed = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
      this._rawValue = false // length constraints apply to the clear value, not to the sealed text
      return SEALED_PREFIX + [nonce, cipher.getAuthTag(), sealed].map((part) => part.toString('base64url')).join('.')
   }

   protected _resolveKey(): Buffer {
      const source = this._key ?? HashProperty._defaultKey
      const given = typeof source === 'function' ? source() : source
      if (given === undefined || given === null || given === '') {
         throw new HashPropertyUnreadableError(this._name, 'no key: give one to the property or call HashProperty.setDefaultKey()')
      }
      const key = typeof given === 'string' ? Buffer.from(given, 'base64') : Buffer.from(given)
      if (key.length !== KEY_BYTES) {
         throw new HashPropertyUnreadableError(this._name, `the key must be ${KEY_BYTES} bytes long, base64 encoded when given as text`)
      }
      return key
   }

   protected _resolveContext(): Buffer {
      const context = typeof this._context === 'function' ? this._context(this._parent) : this._context
      return Buffer.from(JSON.stringify([context ?? this._name]), 'utf8')
   }

   /**
    * Compares a raw cleartext string against the stored hashed value.
    * Automatically applies the configured salt and algorithm to the input before comparison.
    * 
    * @param value - The raw cleartext string to test.
    * @returns True if the hashed input matches the stored hash, false otherwise.
    */
   compare(value: string): boolean {
      if (this.reversible) {
         const clear = this.reveal()
         if (clear === undefined) {
            return false
         }
         const expected = createHash('sha256').update(clear).digest()
         return timingSafeEqual(expected, createHash('sha256').update(String(value)).digest())
      }
      return this._hash(value) === this._value
   }
}
