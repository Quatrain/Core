import { ServerAdapter } from './types'
import { Core } from '@quatrain/core'

export class Api extends Core {
   private static servers: Map<string, ServerAdapter> = new Map()
   static logger = this.addLogger('Api')


   static addServer(adapter: ServerAdapter, name: string = 'default'): void {
      Api.servers.set(name, adapter)
   }

   static getServer(name: string = 'default'): ServerAdapter {
      const adapter = Api.servers.get(name)
      if (!adapter) {
         throw new Error(`Server '${name}' not found`)
      }
      return adapter
   }
}
