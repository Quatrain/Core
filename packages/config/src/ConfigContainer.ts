import { AbstractConfigSource, isSafeKey } from './sources/AbstractConfigSource'
import { MemoryConfigSource } from './sources/MemoryConfigSource'
import { ConfigurationError } from './errors/ConfigurationError'

/**
 * Safely deep-merges source records into target without prototype pollution.
 */
function deepMerge(
   target: Record<string, unknown>,
   source: Record<string, unknown>,
): Record<string, unknown> {
   for (const key of Object.keys(source)) {
      if (!isSafeKey(key)) {
         continue
      }
      const sourceVal = Reflect.get(source, key)
      const targetVal = Reflect.get(target, key)

      if (
         typeof sourceVal === 'object' &&
         sourceVal !== null &&
         !Array.isArray(sourceVal) &&
         typeof targetVal === 'object' &&
         targetVal !== null &&
         !Array.isArray(targetVal)
      ) {
         Reflect.set(
            target,
            key,
            deepMerge(
               targetVal as Record<string, unknown>,
               sourceVal as Record<string, unknown>,
            ),
         )
      } else {
         Reflect.set(target, key, sourceVal)
      }
   }
   return target
}

/**
 * Safely formats raw values for error messages without falling back to [object Object].
 */
function formatRawValue(val: unknown): string {
   if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return String(val)
   }
   if (typeof val === 'object' && val !== null) {
      try {
         return JSON.stringify(val)
      } catch {
         return '[Complex Object]'
      }
   }
   return String(val as string | number | boolean | null | undefined)
}

/**
 * Isolated configuration container managing prioritized sources for a specific namespace or scope.
 */
export class ConfigContainer {
   readonly namespace: string
   protected _sources: AbstractConfigSource[]
   protected _memorySource: MemoryConfigSource

   /**
    * Construct a new ConfigContainer.
    *
    * @param namespace - Namespace or tool identifier (e.g. '@default', 'odoo', 'supabase').
    * @param initialSources - Optional initial array of configuration sources.
    */
   constructor(namespace = '@default', initialSources: AbstractConfigSource[] = []) {
      this.namespace = namespace
      this._memorySource = new MemoryConfigSource({}, `${namespace}:memory`, 100)
      this._sources = [this._memorySource]

      for (const src of initialSources) {
         this.addSource(src)
      }
   }

   /**
    * Registers an additional configuration source into this container.
    * Sources are automatically sorted by priority descending.
    *
    * @param source - Configuration source provider.
    * @returns This container instance for fluent chaining.
    */
   addSource(source: AbstractConfigSource): this {
      this._sources.push(source)
      this._sources.sort((a, b) => b.priority - a.priority)
      return this
   }

   /**
    * Sets a configuration value directly in the highest-priority memory store.
    *
    * @param path - Property key or dot-notation path.
    * @param value - Value to set.
    */
   set(path: string, value: unknown): void {
      this._memorySource.set(path, value)
   }

   /**
    * Retrieves a value across all sources by descending priority order.
    *
    * @param path - Property key or dot-notation path.
    * @param fallback - Optional fallback value if not found.
    * @returns The resolved value or fallback.
    */
   get<T = unknown>(path: string, fallback?: T): T | undefined {
      for (const source of this._sources) {
         const val = source.get(path)
         if (val !== undefined) {
            return val as T
         }
      }
      return fallback
   }

   /**
    * Checks whether a value exists across any registered source.
    *
    * @param path - Property key or dot-notation path.
    * @returns True if defined in at least one source.
    */
   has(path: string): boolean {
      for (const source of this._sources) {
         if (source.has(path)) {
            return true
         }
      }
      return false
   }

   /**
    * Requires a parameter to exist and not be null or empty string.
    * Throws ConfigurationError immediately on missing values (Fail-Fast).
    *
    * @param path - Property key or dot-notation path.
    * @param helpText - Optional remediation guidance.
    * @returns The resolved value typed as T.
    * @throws {ConfigurationError} If parameter is missing or empty string.
    */
   require<T = unknown>(path: string, helpText?: string): T {
      const val = this.get<T>(path)

      if (val === undefined || val === null) {
         throw new ConfigurationError(
            path,
            this.namespace,
            'Missing required configuration parameter',
            helpText,
         )
      }

      if (typeof val === 'string' && val.trim() === '') {
         throw new ConfigurationError(
            path,
            this.namespace,
            'Configuration parameter cannot be an empty string',
            helpText,
         )
      }

      return val
   }

   /**
    * Requires a non-empty string parameter (Fail-Fast).
    *
    * @param path - Property key or dot-notation path.
    * @param helpText - Optional remediation guidance.
    * @returns The resolved trimmed string.
    */
   requireString(path: string, helpText?: string): string {
      const raw = this.require<unknown>(path, helpText)

      if (typeof raw !== 'string') {
         throw new ConfigurationError(
            path,
            this.namespace,
            `Expected string value but received ${typeof raw}`,
            helpText,
         )
      }

      const trimmed = raw.trim()
      if (trimmed === '') {
         throw new ConfigurationError(
            path,
            this.namespace,
            'Configuration parameter cannot be an empty string',
            helpText,
         )
      }

      return trimmed
   }

   /**
    * Requires a numeric parameter (Fail-Fast).
    * Supports string representations of numbers (e.g. "8080" -> 8080).
    *
    * @param path - Property key or dot-notation path.
    * @param helpText - Optional remediation guidance.
    * @returns The resolved number.
    */
   requireNumber(path: string, helpText?: string): number {
      const raw = this.require<unknown>(path, helpText)

      if (typeof raw === 'number') {
         if (Number.isNaN(raw)) {
            throw new ConfigurationError(
               path,
               this.namespace,
               'Configuration parameter is NaN',
               helpText,
            )
         }
         return raw
      }

      if (typeof raw === 'string') {
         const parsed = Number(raw.trim())
         if (!Number.isNaN(parsed)) {
            return parsed
         }
      }

      throw new ConfigurationError(
         path,
         this.namespace,
         `Expected numeric value but received ${formatRawValue(raw)}`,
         helpText,
      )
   }

   /**
    * Requires a boolean parameter (Fail-Fast).
    * Accepts true, false, "true", "false", "1", "0".
    *
    * @param path - Property key or dot-notation path.
    * @param helpText - Optional remediation guidance.
    * @returns The resolved boolean.
    */
   requireBoolean(path: string, helpText?: string): boolean {
      const raw = this.require<unknown>(path, helpText)

      if (typeof raw === 'boolean') {
         return raw
      }

      if (typeof raw === 'string') {
         const lower = raw.trim().toLowerCase()
         if (lower === 'true' || lower === '1') {
            return true
         }
         if (lower === 'false' || lower === '0') {
            return false
         }
      }

      throw new ConfigurationError(
         path,
         this.namespace,
         `Expected boolean value (true/false/1/0) but received ${formatRawValue(raw)}`,
         helpText,
      )
   }

   /**
    * Requires an array parameter (Fail-Fast).
    *
    * @param path - Property key or dot-notation path.
    * @param helpText - Optional remediation guidance.
    * @returns The resolved array.
    */
   requireArray<T = unknown>(path: string, helpText?: string): T[] {
      const raw = this.require<unknown>(path, helpText)

      if (!Array.isArray(raw)) {
         throw new ConfigurationError(
            path,
            this.namespace,
            `Expected array value but received ${typeof raw}`,
            helpText,
         )
      }

      return raw as T[]
   }

   /**
    * Requires a value matching an allowed set of enum values (Fail-Fast).
    *
    * @param path - Property key or dot-notation path.
    * @param allowedValues - Array of allowed string constants.
    * @param helpText - Optional remediation guidance.
    * @returns The validated enum string.
    */
   requireEnum<T extends string>(
      path: string,
      allowedValues: readonly T[],
      helpText?: string,
   ): T {
      const val = this.requireString(path, helpText) as T

      if (!allowedValues.includes(val)) {
         const allowedList = allowedValues.join(', ')
         throw new ConfigurationError(
            path,
            this.namespace,
            `Value "${val}" is invalid. Allowed options are: [${allowedList}]`,
            helpText,
         )
      }

      return val
   }

   /**
    * Retrieves an optional string parameter.
    */
   getString(path: string, fallback?: string): string | undefined {
      const val = this.get<unknown>(path)
      if (val === undefined || val === null) {
         return fallback
      }
      if (typeof val === 'string') {
         return val.trim()
      }
      if (typeof val === 'number' || typeof val === 'boolean') {
         return String(val)
      }
      return fallback
   }

   /**
    * Retrieves an optional number parameter.
    */
   getNumber(path: string, fallback?: number): number | undefined {
      const val = this.get<unknown>(path)
      if (val === undefined || val === null) {
         return fallback
      }
      if (typeof val === 'number') {
         return Number.isNaN(val) ? fallback : val
      }
      if (typeof val === 'string' && val.trim() !== '') {
         const parsed = Number(val)
         return Number.isNaN(parsed) ? fallback : parsed
      }
      return fallback
   }

   /**
    * Retrieves an optional boolean parameter.
    */
   getBoolean(path: string, fallback?: boolean): boolean | undefined {
      const val = this.get<unknown>(path)
      if (val === undefined || val === null) {
         return fallback
      }
      if (typeof val === 'boolean') {
         return val
      }
      if (typeof val === 'string') {
         const lower = val.trim().toLowerCase()
         if (lower === 'true' || lower === '1') {
            return true
         }
         if (lower === 'false' || lower === '0') {
            return false
         }
      }
      if (typeof val === 'number') {
         if (val === 1) {
            return true
         }
         if (val === 0) {
            return false
         }
      }
      return fallback
   }

   /**
    * Creates a scoped sub-container focused on a specific sub-path.
    * Accesses to 'port' in `scope('api')` automatically query 'api.port'.
    *
    * @param subPath - Dot-notation prefix path.
    * @returns A new ConfigContainer scoped to the subPath.
    */
   scope(subPath: string): ConfigContainer {
      let cleanSubPath = subPath
      while (cleanSubPath.endsWith('.')) {
         cleanSubPath = cleanSubPath.slice(0, -1)
      }
      const subNamespace = `${this.namespace}.${cleanSubPath}`

      const subSource = new (class extends AbstractConfigSource {
         readonly name = `scoped:${cleanSubPath}`
         readonly priority = 100

         constructor(protected parent: ConfigContainer) {
            super()
         }

         get(key: string): unknown {
            return this.parent.get(`${cleanSubPath}.${key}`)
         }

         has(key: string): boolean {
            return this.parent.has(`${cleanSubPath}.${key}`)
         }

         getAll(): Record<string, unknown> {
            const subTree = this.parent.get<unknown>(cleanSubPath)
            if (typeof subTree === 'object' && subTree !== null && !Array.isArray(subTree)) {
               return { ...(subTree as Record<string, unknown>) }
            }
            return {}
         }
      })(this)

      return new ConfigContainer(subNamespace, [subSource])
   }

   /**
    * Collapses all sources into a single merged key-value record snapshot.
    */
   toRecord(): Record<string, unknown> {
      let record: Record<string, unknown> = {}

      // Apply lowest priority sources first so higher priority sources override
      const reversed = [...this._sources].reverse()
      for (const source of reversed) {
         const data = source.getAll()
         record = deepMerge(record, data)
      }

      return record
   }
}
