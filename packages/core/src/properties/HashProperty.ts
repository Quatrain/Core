import { createHash } from 'node:crypto'
import { StringProperty, StringPropertyType } from './StringProperty'
import { Core } from '../Core'

export type HashPropertyAlgos =
   | typeof HashProperty.ALGORITHM_MD5
   | typeof HashProperty.ALGORITHM_SHA1
   | typeof HashProperty.ALGORITHM_SHA256
   | typeof HashProperty.ALGORITHM_BCRYPT

/**
 * Configuration dictionary for instantiating a `HashProperty`.
 * Extends `StringPropertyType` to add hashing capabilities.
 *
 * | Parameter | Type | Description | Default |
 * | :--- | :--- | :--- | :--- |
 * | `algorithm` | HashPropertyAlgos | The cryptographic hashing algorithm to use. | `ALGORITHM_SHA256` |
 * | `salt` | string | An optional salt string appended to the value before hashing. | `""` |
 * | `prefixed` | boolean | If true, prepends the algorithm name to the output (e.g. `md5-abc...`). | `false` |
 */
export interface HashPropertyType extends StringPropertyType {
   algorithm?: HashPropertyAlgos
   salt?: string
   prefixed?: boolean
}

/**
 * A specialized string property that automatically hashes incoming values before storing them.
 * Useful for storing passwords, secret tokens, or generating unique fingerprints.
 * Values set on this property are one-way hashed and cannot be reversed.
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

   protected _algorithm: HashPropertyAlgos
   protected _salt: string = ''
   protected _prefixed = false

   constructor(config: HashPropertyType) {
      super(config)
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
      return super.set(this._hash(value), setChanged)
   }

   /**
    * Compares a raw cleartext string against the stored hashed value.
    * Automatically applies the configured salt and algorithm to the input before comparison.
    * 
    * @param value - The raw cleartext string to test.
    * @returns True if the hashed input matches the stored hash, false otherwise.
    */
   compare(value: string): boolean {
      return this._hash(value) === this._value
   }
}
