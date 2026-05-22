import { BackendContext, asyncContextMiddleware } from './BackendContext'
import { AsyncLocalStorage } from 'async_hooks'

describe('BackendContext', () => {
   it('should be an instance of AsyncLocalStorage', () => {
      expect(BackendContext).toBeInstanceOf(AsyncLocalStorage)
   })

   it('should execute middleware and run within context', (done) => {
      const req = {}
      const res = {}
      const next = () => {
         const store = BackendContext.getStore()
         expect(store).toBeDefined()
         expect(store).toEqual({})
         done()
      }

      asyncContextMiddleware(req, res, next)
   })

   it('should allow getting and setting context variables', (done) => {
      BackendContext.run({ user: undefined, testKey: 'testValue' }, () => {
         const store = BackendContext.getStore()
         expect(store).toBeDefined()
         expect(store?.testKey).toBe('testValue')
         
         if (store) {
            store.user = { email: 'test@user.com' } as any
         }
         
         expect(BackendContext.getStore()?.user).toBeDefined()
         done()
      })
   })
})
