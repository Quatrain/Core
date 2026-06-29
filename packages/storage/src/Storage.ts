import { Core } from '@quatrain/core'
import { AbstractStorageAdapter } from './AbstractStorageAdapter'

/**
 * Backend Parameters acceptable keys
 */
export type StorageParametersKeys = 'region' | 'alias' | 'config' | 'debug'

/**
 * Backend parameters interface
 */
export interface StorageParameters {
   endpoint?: string
   region?: string
   alias?: string
   config?: any
   debug?: boolean
}

export type StorageBackendRegistry<T extends AbstractStorageAdapter> = {
   [x: string]: T
}
/**
 * Global registry and utility class for managing multiple storage backends.
 * Follows the Quatrain Core convention of centralizing dependency access via aliases.
 */
export class Storage extends Core {
   /** The fallback storage alias used when none is explicitly requested. */
   static defaultStorage = ''
   /** Global configuration flag to control whether uploads overwrite existing files by default (upsert). */
   static defaultUpsert = true
   /** Central logger scope dedicated to the Storage subsystem. */
   static logger = this.addLogger('Storage')

   protected static _storages: StorageBackendRegistry<any> = {}

   /**
    * Registers an instantiated storage adapter into the global registry.
    * 
    * @param adapter - The initialized adapter (e.g. `S3StorageAdapter`).
    * @param alias - The string identifier to register it under.
    * @param setDefault - Whether this should become the global default backend.
    */
   static addStorage(
      adapter: AbstractStorageAdapter,
      alias: string,
      setDefault: boolean = false
   ) {
      this._storages[alias] = adapter
      this.info(
         `Added storage adapter ${adapter.constructor.name} with alias '${alias}'`
      )
      if (setDefault === true) {
         this.defaultStorage = alias
      }
   }

   /**
    * Retrieves a previously registered storage adapter by its alias.
    * 
    * @param alias - The target registry identifier. Defaults to `defaultStorage`.
    * @returns The adapter instance.
    * @throws {Error} If the alias is not registered.
    */
   static getStorage<T extends AbstractStorageAdapter>(
      alias: string = this.defaultStorage
   ): T {
      if (this._storages[alias]) {
         return this._storages[alias]
      } else {
         throw new Error(`Unknown storage alias: '${alias}'`)
      }
   }
}
