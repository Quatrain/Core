import { CacheAdapterInterface } from './CacheAdapterInterface'
import { Core } from '@quatrain/core'

export class Cache extends Core {
   private static _adapters: Map<string, CacheAdapterInterface> = new Map()

   public static register(name: string, adapter: CacheAdapterInterface): void {
      this._adapters.set(name, adapter)
   }

   public static get(name: string): CacheAdapterInterface | undefined {
      return this._adapters.get(name)
   }

   public static getAll(): CacheAdapterInterface[] {
      return Array.from(this._adapters.values())
   }

   public static unregister(name: string): void {
      this._adapters.delete(name)
   }

   public static clearRegistry(): void {
      this._adapters.clear()
   }
}
