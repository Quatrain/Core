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
export class Storage extends Core {
   static defaultStorage = ''
   static logger = this.addLogger('Storage')

   protected static _storages: StorageBackendRegistry<any> = {}

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
