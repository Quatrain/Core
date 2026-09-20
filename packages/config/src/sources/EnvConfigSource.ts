import { AbstractConfigSource, isSafeKey } from './AbstractConfigSource'

/**
 * Options for configuring the Environment configuration source.
 */
export interface EnvConfigSourceOptions {
   /**
    * Custom dictionary representing environment variables.
    * Defaults to process.env if available, or empty object.
    */
   env?: Record<string, string | undefined>

   /**
    * Optional prefix prepended to keys during lookup (e.g. 'APP_' or 'ODOO_').
    */
   prefix?: string

   /**
    * Source identifier name. Defaults to 'environment'.
    */
   name?: string

   /**
    * Priority level. Defaults to 50.
    */
   priority?: number
}

/**
 * Configuration source reading from process environment variables.
 * Translates dot-notation paths (e.g. 'database.host') to environment naming (e.g. 'DATABASE_HOST').
 */
export class EnvConfigSource extends AbstractConfigSource {
   readonly name: string
   readonly priority: number
   protected _env: Map<string, string | undefined>
   protected _prefix: string

   /**
    * Construct a new EnvConfigSource.
    *
    * @param options - Configuration options.
    */
   constructor(options?: EnvConfigSourceOptions) {
      super()
      this.name = options?.name ?? 'environment'
      this.priority = options?.priority ?? 50
      this._prefix = options?.prefix ?? ''

      if (options?.env) {
         this._env = new Map(Object.entries(options.env))
      } else if (typeof process !== 'undefined') {
         this._env = new Map(Object.entries(process.env))
      } else {
         this._env = new Map()
      }
   }

   /**
    * Retrieves an environment variable.
    * Checks the following formats in order:
    * 1. Exact key as passed
    * 2. Key with configured prefix (if any)
    * 3. Dot-notation converted to UPPER_SNAKE_CASE (e.g. 'api.host' -> 'API_HOST')
    * 4. Dot-notation converted with prefix (e.g. 'api.host' -> 'PREFIX_API_HOST')
    *
    * @param key - Property key or dot-notation path.
    * @returns String value if defined and non-empty, or undefined.
    */
   get(key: string): string | undefined {
      if (!isSafeKey(key)) {
         return undefined
      }

      const candidates = this._resolveCandidateKeys(key)

      for (const candidate of candidates) {
         const val = this._env.get(candidate)
         if (val !== undefined) {
            return val
         }
      }

      return undefined
   }

   /**
    * Checks whether any candidate key exists in the environment.
    *
    * @param key - Property key or dot-notation path.
    */
   has(key: string): boolean {
      return this.get(key) !== undefined
   }

   /**
    * Returns all environment key-value pairs matching this source.
    */
   getAll(): Record<string, unknown> {
      const result: Record<string, unknown> = {}
      for (const [key, val] of this._env.entries()) {
         if (!this._prefix || key.startsWith(this._prefix)) {
            if (isSafeKey(key)) {
               Reflect.set(result, key, val)
            }
         }
      }
      return result
   }

   /**
    * Converts camelCase, dot-notation, or kebab-case into UPPER_SNAKE_CASE.
    */
   protected _toSnakeCase(key: string): string {
      return key
         .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
         .replace(/[.-]/g, '_')
         .toUpperCase()
   }

   /**
    * Internal helper generating candidate environment variable names.
    */
   protected _resolveCandidateKeys(key: string): string[] {
      const candidates: string[] = []
      const snakeKey = this._toSnakeCase(key)

      if (this._prefix) {
         if (key.startsWith(this._prefix)) {
            candidates.push(key)
            if (!candidates.includes(snakeKey)) {
               candidates.push(snakeKey)
            }
         } else {
            const prefixedExact = `${this._prefix}${key}`
            const prefixedSnake = `${this._prefix}${snakeKey}`
            candidates.push(prefixedExact)
            if (!candidates.includes(prefixedSnake)) {
               candidates.push(prefixedSnake)
            }
            // Fallback to exact raw key if directly requested
            if (!candidates.includes(key)) {
               candidates.push(key)
            }
         }
      } else {
         candidates.push(key)
         if (!candidates.includes(snakeKey)) {
            candidates.push(snakeKey)
         }
      }

      return candidates
   }
}
