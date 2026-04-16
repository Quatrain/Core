import { AsyncLocalStorage } from 'async_hooks'
import { User } from './User'

export interface BackendStore {
   user?: User
   [key: string]: any
}

export const BackendContext = new AsyncLocalStorage<BackendStore>()

export const asyncContextMiddleware = (req: any, res: any, next: any) => {
   BackendContext.run({}, () => {
      next()
   })
}
