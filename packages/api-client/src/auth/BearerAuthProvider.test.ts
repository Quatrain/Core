import { BearerAuthProvider } from './BearerAuthProvider'

describe('BearerAuthProvider', () => {
   it('should generate headers using a static token string', async () => {
      const provider = new BearerAuthProvider('my-token')
      const headers = await provider.getHeaders()
      expect(headers).toBeDefined()
      expect(headers.Authorization).toBe('Bearer my-token')
   })

   it('should generate headers using a synchronous callback', async () => {
      const provider = new BearerAuthProvider(() => 'sync-token')
      const headers = await provider.getHeaders()
      expect(headers).toBeDefined()
      expect(headers.Authorization).toBe('Bearer sync-token')
   })

   it('should generate headers using an asynchronous callback', async () => {
      const provider = new BearerAuthProvider(async () => 'async-token')
      const headers = await provider.getHeaders()
      expect(headers).toBeDefined()
      expect(headers.Authorization).toBe('Bearer async-token')
   })
})
