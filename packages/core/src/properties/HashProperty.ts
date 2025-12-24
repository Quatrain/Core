import { createHash } from 'node:crypto'
import { StringProperty, StringPropertyType } from './StringProperty'

export type HashPropertyAlgos =
   | typeof HashProperty.ALGORITHM_MD5
   | typeof HashProperty.ALGORITHM_SHA1
   | typeof HashProperty.ALGORITHM_SHA256
   | typeof HashProperty.ALGORITHM_BCRYPT

export interface HashPropertyType extends StringPropertyType {
   algorithm?: HashPropertyAlgos
   salt?: string
   prefixed?: boolean
}

export class HashProperty extends StringProperty {
   static TYPE = 'hash'
   static ALGORITHM_MD5 = 'md5'
   static ALGORITHM_SHA1 = 'sha1'
   static ALGORITHM_SHA256 = 'sha256'
   static ALGORITHM_BCRYPT = 'bcrypt'

   protected _algorithm: HashPropertyAlgos
   protected _salt: string = ''
   protected _prefixed = false

   constructor(config: HashPropertyType) {
      super(config)
      this._algorithm = config.algorithm || HashProperty.ALGORITHM_MD5
      this._salt = config.salt || ''
      this._prefixed = config.prefixed || false
   }

   _hash(value: string): string {
      let algo
      switch (this._algorithm) {
         case HashProperty.ALGORITHM_MD5:
            algo = createHash('md5')
            break

         case HashProperty.ALGORITHM_SHA1:
            algo = createHash('sha1')
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

   set(value: string, setChanged = true) {
      return super.set(this._hash(value), setChanged)
   }

   compare(value: string): boolean {
      return this._hash(value) === this._value
   }
}
