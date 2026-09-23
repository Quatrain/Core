import {
   AbstractLoggerAdapter,
   DefaultLoggerAdapter,
   Log,
   LogLevel,
} from '@quatrain/log'
import { ConfigContainer } from './ConfigContainer'
import { AbstractConfigSource } from './sources/AbstractConfigSource'
import { ObjectConfigSource } from './sources/ObjectConfigSource'
import { EnvConfigSource } from './sources/EnvConfigSource'
import { ConfigurationError } from './errors/ConfigurationError'

/**
 * Registry mapping aliases to their configured ConfigContainer instances.
 */
export type ConfigRegistry = Map<string, ConfigContainer>

/**
 * Pivot class for managing application and agent tool configurations across Quatrain.
 * Manages a central registry of isolated configuration namespaces,
 * mirroring sister classes such as `Backend`, `Storage`, `Log`, and `Queue`.
 */
export class Config {
   /**
    * Internal store for the default configuration alias.
    */
   protected static _defaultConfig = '@default'

   /**
    * The alias of the currently active default configuration container.
    */
   static get defaultConfig(): string {
      return this._defaultConfig
   }

   static set defaultConfig(alias: string) {
      this._defaultConfig = alias
   }

   /**
    * Dedicated logger scope for the Config subsystem.
    */
   static readonly logger: AbstractLoggerAdapter = Log.addLogger(
      '@Config',
      new DefaultLoggerAdapter('Config', LogLevel.DEBUG),
      true
   )

   /**
    * Internal registry mapping aliases to ConfigContainer instances.
    */
   protected static _configs: ConfigRegistry = new Map<string, ConfigContainer>()

   /**
    * Registers a new or existing configuration container under a specific alias.
    *
    * @param alias - Short identifier name (e.g. 'odoo', 'google-drive', 'supabase').
    * @param dataOrSource - Object data, custom AbstractConfigSource, or ConfigContainer.
    * @param setDefault - Whether to set this alias as the default target.
    * @returns The registered ConfigContainer.
    */
   static addConfig(
      alias: string,
      dataOrSource?: Record<string, unknown> | AbstractConfigSource | ConfigContainer,
      setDefault = false,
   ): ConfigContainer {
      let container: ConfigContainer

      if (dataOrSource instanceof ConfigContainer) {
         container = dataOrSource
      } else if (dataOrSource instanceof AbstractConfigSource) {
         container = new ConfigContainer(alias, [dataOrSource])
      } else if (dataOrSource && typeof dataOrSource === 'object' && !Array.isArray(dataOrSource)) {
         container = new ConfigContainer(alias, [
            new ObjectConfigSource(dataOrSource, `${alias}:object`),
         ])
      } else {
         container = new ConfigContainer(alias)
      }

      this._configs.set(alias, container)
      this.logger.debug(`Registered config container under alias "${alias}"`)

      if (setDefault) {
         this.defaultConfig = alias
      }

      return container
   }

   /**
    * Retrieves an existing configuration container by alias.
    * If the default alias is requested but not yet registered, an automatic default
    * container wired to environment variables is initialized.
    *
    * @param alias - Target alias identifier. Defaults to defaultConfig ('@default').
    * @returns The resolved ConfigContainer.
    * @throws {ConfigurationError} If a custom alias is requested but not registered.
    */
   static getConfig(alias: string = this.defaultConfig): ConfigContainer {
      if (alias === this.defaultConfig && !this._configs.has(this.defaultConfig)) {
         const defaultContainer = new ConfigContainer(this.defaultConfig, [
            new EnvConfigSource(),
         ])
         this._configs.set(this.defaultConfig, defaultContainer)
         return defaultContainer
      }

      const existing = this._configs.get(alias)
      if (existing !== undefined) {
         return existing
      }

      throw new ConfigurationError(
         alias,
         'registry',
         `No configuration registered under alias "${alias}". Use Config.addConfig('${alias}', ...) before accessing it.`,
      )
   }

   /**
    * Accesses a fine-grained configuration scope.
    * If alias exists directly in the registry, returns that container.
    * Otherwise, resolves a sub-scope on the default container.
    *
    * @param aliasOrPath - Registered namespace alias or dot-notation path.
    * @returns Scoped ConfigContainer.
    */
   static scope(aliasOrPath: string): ConfigContainer {
      if (this.hasConfig(aliasOrPath)) {
         return this.getConfig(aliasOrPath)
      }
      return this.getConfig().scope(aliasOrPath)
   }

   /**
    * Checks if a configuration alias is currently registered.
    *
    * @param alias - Target alias identifier.
    */
   static hasConfig(alias: string): boolean {
      return this._configs.has(alias)
   }

   /**
    * Removes a registered configuration container from the registry.
    *
    * @param alias - Target alias identifier.
    * @returns True if the container was removed.
    */
   static removeConfig(alias: string): boolean {
      return this._configs.delete(alias)
   }

   /**
    * Clears all registered configurations and resets the default alias.
    * Useful for isolating unit tests.
    */
   static clear(): void {
      this._configs.clear()
      this.defaultConfig = '@default'
   }

   // --------------------------------------------------------------------------
   // Global Shortcuts (Delegating to the default container)
   // --------------------------------------------------------------------------

   /**
    * Sets a configuration value on the default container.
    */
   static set(path: string, value: unknown, alias: string = this.defaultConfig): void {
      this.getConfig(alias).set(path, value)
   }

   /**
    * Retrieves a value from the default container.
    */
   static get<T = unknown>(
      path: string,
      fallback?: T,
      alias: string = this.defaultConfig,
   ): T | undefined {
      return this.getConfig(alias).get<T>(path, fallback)
   }

   /**
    * Requires a parameter on the default container (Fail-Fast).
    */
   static require<T = unknown>(
      path: string,
      helpText?: string,
      alias: string = this.defaultConfig,
   ): T {
      return this.getConfig(alias).require<T>(path, helpText)
   }

   /**
    * Requires a non-empty string on the default container (Fail-Fast).
    */
   static requireString(
      path: string,
      helpText?: string,
      alias: string = this.defaultConfig,
   ): string {
      return this.getConfig(alias).requireString(path, helpText)
   }

   /**
    * Requires a number on the default container (Fail-Fast).
    */
   static requireNumber(
      path: string,
      helpText?: string,
      alias: string = this.defaultConfig,
   ): number {
      return this.getConfig(alias).requireNumber(path, helpText)
   }

   /**
    * Requires a boolean on the default container (Fail-Fast).
    */
   static requireBoolean(
      path: string,
      helpText?: string,
      alias: string = this.defaultConfig,
   ): boolean {
      return this.getConfig(alias).requireBoolean(path, helpText)
   }

   /**
    * Requires an array on the default container (Fail-Fast).
    */
   static requireArray<T = unknown>(
      path: string,
      helpText?: string,
      alias: string = this.defaultConfig,
   ): T[] {
      return this.getConfig(alias).requireArray<T>(path, helpText)
   }

   /**
    * Requires an enum value on the default container (Fail-Fast).
    */
   static requireEnum<T extends string>(
      path: string,
      allowedValues: readonly T[],
      helpText?: string,
      alias: string = this.defaultConfig,
   ): T {
      return this.getConfig(alias).requireEnum<T>(path, allowedValues, helpText)
   }

   /**
    * Retrieves an optional string on the default container.
    */
   static getString(
      path: string,
      fallback?: string,
      alias: string = this.defaultConfig,
   ): string | undefined {
      return this.getConfig(alias).getString(path, fallback)
   }

   /**
    * Retrieves an optional number on the default container.
    */
   static getNumber(
      path: string,
      fallback?: number,
      alias: string = this.defaultConfig,
   ): number | undefined {
      return this.getConfig(alias).getNumber(path, fallback)
   }

   /**
    * Retrieves an optional boolean on the default container.
    */
   static getBoolean(
      path: string,
      fallback?: boolean,
      alias: string = this.defaultConfig,
   ): boolean | undefined {
      return this.getConfig(alias).getBoolean(path, fallback)
   }
}
