import { Core } from '@quatrain/core'
import Middleware from './middlewares/Middleware'
import { AbstractBackendAdapter } from './AbstractBackendAdapter'

export enum BackendAction {
   CREATE = 'create',
   READ = 'read',
   UPDATE = 'update',
   DELETE = 'delete',
   WRITE = 'write',
}

/**
 * Default interface for a backend record
 */
export interface BackendRecordType {
   uid: string | undefined
   path: string | undefined
   [key: string]: any
}

/**
 * Backend Parameters acceptable keys
 */
export type BackendParametersKeys =
   | 'host'
   | 'alias'
   | 'mapping'
   | 'middlewares'
   | 'config'
   | 'fixtures'
   | 'softDelete'
   | 'debug'

/**
 * Backend parameters interface
 */
export interface BackendParameters {
   host?: string
   alias?: string
   hierarchy?: { [collection: string]: any }
   mapping?: { [x: string]: any }
   middlewares?: Middleware[]
   config?: any
   fixtures?: any
   softDelete?: boolean
   useNativeForeignKeys?: boolean
   debug?: boolean
}

export type BackendRegistry<T extends AbstractBackendAdapter> = {
   [x: string]: T
}

export class Backend extends Core {
   static defaultBackend = 'default'
   static userClass: any
   static logger = this.addLogger('Backend')

   protected static _backends: BackendRegistry<any> = {}

   static addBackend(
      backend: AbstractBackendAdapter,
      alias: string,
      setDefault: boolean = false
   ) {
      this._backends[alias] = backend
      if (setDefault) {
         this.defaultBackend = alias
      }
   }

   static getBackend<T extends AbstractBackendAdapter>(
      alias: string = this.defaultBackend
   ): T {
      if (this._backends[alias]) {
         return this._backends[alias]
      } else {
         throw new Error(`Unknown backend alias: '${alias}'`)
      }
   }
}
