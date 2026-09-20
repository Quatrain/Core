/**
 * Guards against Prototype Pollution by blocking dangerous object properties.
 */
export function isSafeKey(key: string): boolean {
   return key !== '__proto__' && key !== 'constructor' && key !== 'prototype'
}

/**
 * Validates that all segments of a dot-notation path are safe from Prototype Pollution.
 */
export function isSafePath(path: string): boolean {
   const parts = path.split('.')
   for (const part of parts) {
      if (!isSafeKey(part)) {
         return false
      }
   }
   return true
}

/**
 * Abstract base contract for all configuration source providers.
 * Concrete providers load configuration from environment variables,
 * structured JSON/JS files, or memory dictionaries.
 */
export abstract class AbstractConfigSource {
   /**
    * Human-readable identifier for this configuration source.
    */
   abstract readonly name: string

   /**
    * Numeric priority level used for resolution ordering.
    * Higher priority sources override lower priority ones.
    */
   abstract readonly priority: number

   /**
    * Retrieves the value associated with a given key from this source.
    *
    * @param key - The property key or dot-notation path.
    * @returns The raw value if present, or undefined.
    */
   abstract get(key: string): unknown

   /**
    * Checks if a given key exists in this configuration source.
    *
    * @param key - The property key or dot-notation path.
    * @returns True if the key is defined in this source.
    */
   abstract has(key: string): boolean

   /**
    * Returns a flat or nested snapshot of all configuration stored in this source.
    *
    * @returns Key-value mapping of all configuration entries.
    */
   abstract getAll(): Record<string, unknown>
}
