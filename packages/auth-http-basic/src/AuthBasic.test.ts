import { AuthBasic } from './AuthBasic'
import { ApiRequest, ApiResponse } from '@quatrain/api'

describe('AuthBasic', () => {
   describe('factory', () => {
      it('should instantiate using username and password parameters', () => {
         const auth = AuthBasic.factory('admin', 'secret')
         expect(auth).toBeInstanceOf(AuthBasic)
         expect((auth as any).user).toBe('admin')
         expect((auth as any).pass).toBe('secret')
      })

      it('should instantiate using config object parameters', () => {
         const auth = AuthBasic.factory({ user: 'operator', pass: 'secure' })
         expect(auth).toBeInstanceOf(AuthBasic)
         expect((auth as any).user).toBe('operator')
         expect((auth as any).pass).toBe('secure')
      })

      it('should return null for missing parameters or incomplete config object', () => {
         expect(AuthBasic.factory('admin')).toBeNull()
         expect(AuthBasic.factory(undefined, 'secret')).toBeNull()
         expect(AuthBasic.factory({ user: 'only-user' })).toBeNull()
         expect(AuthBasic.factory({ pass: 'only-pass' })).toBeNull()
         expect(AuthBasic.factory({})).toBeNull()
      })
   })

   describe('middleware', () => {
      let auth: AuthBasic
      let mockRes: ApiResponse
      let headersSent: Record<string, string>
      let responseStatus: number
      let responseSentData: string

      beforeEach(() => {
         auth = AuthBasic.factory('admin', 'secret') as AuthBasic
         headersSent = {}
         responseStatus = 200
         responseSentData = ''

         mockRes = {
            status: (code: number) => {
               responseStatus = code
               return mockRes
            },
            json: (data: any) => {},
            send: (data: string) => {
               responseSentData = data
            },
            setHeader: (name: string, value: string) => {
               headersSent[name] = value
            },
            write: (data: string) => {},
            end: () => {}
         } as any
      })

      it('should allow valid authorization headers', async () => {
         const credentials = Buffer.from('admin:secret').toString('base64')
         const mockReq: ApiRequest = {
            headers: {
               authorization: `Basic ${credentials}`
            },
            query: {},
            params: {},
            body: {}
         }

         const middleware = auth.middleware()
         const result = await middleware(mockReq, mockRes)

         expect(result).toBe(true)
         expect(responseStatus).toBe(200)
      })

      it('should reject invalid or missing authorization headers', async () => {
         const mockReq: ApiRequest = {
            headers: {
               authorization: 'Basic wrong'
            },
            query: {},
            params: {},
            body: {}
         }

         const middleware = auth.middleware()
         const result = await middleware(mockReq, mockRes)

         expect(result).toBe(false)
         expect(responseStatus).toBe(401)
         expect(headersSent['WWW-Authenticate']).toBe('Basic realm="Core API"')
         expect(responseSentData).toBe('Authentication required.')
      })

      it('should handle empty or missing authorization header values gracefully', async () => {
         const mockReq: ApiRequest = {
            headers: {},
            query: {},
            params: {},
            body: {}
         }

         const middleware = auth.middleware()
         const result = await middleware(mockReq, mockRes)

         expect(result).toBe(false)
         expect(responseStatus).toBe(401)
         expect(headersSent['WWW-Authenticate']).toBe('Basic realm="Core API"')
      })
   })
})
