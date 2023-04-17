import { StringProperty, StringPropertyType } from './StringProperty'

export type HashPropertyAlgos =
   | typeof HashProperty.ALGORITHM_MD5
   | typeof HashProperty.ALGORITHM_SHA1
   | typeof HashProperty.ALGORITHM_SHA256

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
      const crypto = require('crypto')
      let algo
      switch (this._algorithm) {
         case HashProperty.ALGORITHM_MD5:
            algo = crypto.createHash('md5')
            break

         case HashProperty.ALGORITHM_SHA1:
            algo = crypto.createHash('sha1')
            break

         case HashProperty.ALGORITHM_SHA256:
            algo = crypto.createHash('sha256')
            break

         case HashProperty.ALGORITHM_BCRYPT:
            break

         default:
            throw new Error(`Insupported or missing hash algorithm`)
      }

      let hash = this._prefixed ? `${this._algorithm}-` : ''
      hash += algo.update(`${this._salt}${value}`).digest('hex')

      this._rawValue = false // don't test some constraints after hashing

      return hash
   }

   set(value: string) {
      return super.set(this._hash(value))
   }

   compare(value: string): boolean {
      return this._hash(value) === this._value
   }
}
