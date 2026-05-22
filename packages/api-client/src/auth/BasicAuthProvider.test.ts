import { BasicAuthProvider } from './BasicAuthProvider'

describe('BasicAuthProvider', () => {
   it('should generate headers using username and password', async () => {
      const provider = new BasicAuthProvider('user', 'pass')
      const headers = await provider.getHeaders()
      expect(headers).toBeDefined()
      expect(headers.Authorization).toBe('Basic dXNlcjpwYXNz')
   })

   it('should generate headers using a pre-encoded token', async () => {
      const provider = new BasicAuthProvider('dXNlcjpwYXNz')
      const headers = await provider.getHeaders()
      expect(headers).toBeDefined()
      expect(headers.Authorization).toBe('Basic dXNlcjpwYXNz')
   })
})
