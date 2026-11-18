import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/**
 * Cost parameters of scrypt.
 */
export interface PasswordHasherOptionsInterface {
   /** Base-2 logarithm of the CPU and memory cost N (default 15, i.e. N = 32768). */
   logN?: number
   /** Block size r (default 8). */
   blockSize?: number
   /** Parallelisation p (default 3). */
   parallelization?: number
}

/** Length of the derived key, in bytes. */
const KEY_LENGTH = 32
/** Length of the random salt, in bytes. */
const SALT_LENGTH = 16
/** Bounds accepted when reading a stored hash, so that a tampered row cannot exhaust the process. */
const MAX_LOG_N = 20
const MAX_BLOCK_SIZE = 16
const MAX_PARALLELIZATION = 16

const HASH_PATTERN = /^\$scrypt\$ln=(\d{1,2}),r=(\d{1,2}),p=(\d{1,2})\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/

function derive(password: string, salt: Buffer, logN: number, blockSize: number, parallelization: number): Promise<Buffer> {
   const cost = 2 ** logN
   const options: ScryptOptions = {
      N: cost,
      r: blockSize,
      p: parallelization,
      // scrypt needs about 128 * N * r bytes; Node refuses above `maxmem` (32 MiB by default).
      maxmem: 256 * cost * blockSize,
   }
   return new Promise((resolve, reject) => {
      scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (error, key) => {
         if (error) {
            reject(error)
            return
         }
         resolve(key)
      })
   })
}

function encode(buffer: Buffer): string {
   return buffer.toString('base64').replace(/=+$/, '')
}

/**
 * Password hashing with scrypt.
 *
 * A hash is a self-describing string, `$scrypt$ln=15,r=8,p=3$<salt>$<key>`, so the cost can be
 * raised later without a migration: {@link PasswordHasher.needsRehash} tells when a stored hash
 * was made with other parameters.
 */
export class PasswordHasher {
   protected _logN: number
   protected _blockSize: number
   protected _parallelization: number

   constructor(options: PasswordHasherOptionsInterface = {}) {
      this._logN = options.logN ?? 15
      this._blockSize = options.blockSize ?? 8
      this._parallelization = options.parallelization ?? 3
      if (
         !Number.isInteger(this._logN) || this._logN < 10 || this._logN > MAX_LOG_N ||
         !Number.isInteger(this._blockSize) || this._blockSize < 1 || this._blockSize > MAX_BLOCK_SIZE ||
         !Number.isInteger(this._parallelization) || this._parallelization < 1 || this._parallelization > MAX_PARALLELIZATION
      ) {
         throw new Error('[PasswordHasher] Invalid scrypt parameters.')
      }
   }

   /**
    * Hashes a password with a fresh random salt.
    *
    * @param password - Clear password.
    * @returns The self-describing hash string.
    */
   async hash(password: string): Promise<string> {
      const salt = randomBytes(SALT_LENGTH)
      const key = await derive(password, salt, this._logN, this._blockSize, this._parallelization)
      return `$scrypt$ln=${this._logN},r=${this._blockSize},p=${this._parallelization}$${encode(salt)}$${encode(key)}`
   }

   /**
    * Checks a password against a stored hash, in constant time with respect to the key.
    *
    * @param password - Clear password.
    * @param stored - Hash string produced by {@link PasswordHasher.hash}.
    * @returns `true` when the password matches; `false` for a mismatch or an unreadable hash.
    */
   async verify(password: string, stored: string): Promise<boolean> {
      const parsed = HASH_PATTERN.exec(stored)
      if (!parsed) {
         return false
      }
      const logN = Number(parsed[1])
      const blockSize = Number(parsed[2])
      const parallelization = Number(parsed[3])
      if (logN < 1 || logN > MAX_LOG_N || blockSize < 1 || blockSize > MAX_BLOCK_SIZE || parallelization < 1 || parallelization > MAX_PARALLELIZATION) {
         return false
      }
      const salt = Buffer.from(parsed[4], 'base64')
      const expected = Buffer.from(parsed[5], 'base64')
      if (expected.length !== KEY_LENGTH) {
         return false
      }
      const key = await derive(password, salt, logN, blockSize, parallelization)
      return timingSafeEqual(key, expected)
   }

   /**
    * Tells whether a stored hash was made with other parameters than the current ones.
    *
    * @param stored - Hash string.
    * @returns `true` when the password should be hashed again at the next successful sign-in.
    */
   needsRehash(stored: string): boolean {
      const parsed = HASH_PATTERN.exec(stored)
      if (!parsed) {
         return true
      }
      return Number(parsed[1]) !== this._logN || Number(parsed[2]) !== this._blockSize || Number(parsed[3]) !== this._parallelization
   }
}
