import { GithubAuthApi } from './GithubAuthApi'
import { ServerAdapter, ApiRequest, ApiResponse } from '@quatrain/api'
import { GithubAuthAdapter } from './GithubAuthAdapter'

describe('GithubAuthApi', () => {
   let mockRouter: any
   let mockAdapter: any
   let routes: Record<string, Function> = {}

   beforeEach(() => {
      routes = {}
      mockRouter = {
         get: jest.fn().mockImplementation((path: string, handler: Function) => {
            routes[path] = handler
         }),
      }

      mockAdapter = {
         getAuthorizationUrl: jest.fn().mockReturnValue('https://github.com/login/authorize'),
         exchangeCodeForToken: jest.fn().mockResolvedValue({
            access_token: 'token-abc',
         }),
      }
   })

   it('should register /login and /callback routes', () => {
      GithubAuthApi(mockRouter as unknown as ServerAdapter, '/api/auth/github', {
         adapter: mockAdapter,
      })

      expect(mockRouter.get).toHaveBeenCalledWith('/login', expect.any(Function))
      expect(mockRouter.get).toHaveBeenCalledWith('/callback', expect.any(Function))
   })

   it('should handle /login route redirect', async () => {
      GithubAuthApi(mockRouter as unknown as ServerAdapter, '/api/auth/github', {
         adapter: mockAdapter,
      })

      const req = {
         query: {
            redirect_uri: 'http://my-callback',
            scopes: 'repo,user',
            state: 'mystate',
         },
      } as unknown as ApiRequest

      const res = {
         status: jest.fn().mockReturnThis(),
         setHeader: jest.fn().mockReturnThis(),
         send: jest.fn(),
      } as unknown as ApiResponse

      await routes['/login'](req, res)

      expect(mockAdapter.getAuthorizationUrl).toHaveBeenCalledWith(
         'http://my-callback',
         ['repo', 'user'],
         'mystate'
      )
      expect(res.status).toHaveBeenCalledWith(302)
      expect(res.setHeader).toHaveBeenCalledWith('Location', 'https://github.com/login/authorize')
   })

   it('should handle /callback route token exchange', async () => {
      GithubAuthApi(mockRouter as unknown as ServerAdapter, '/api/auth/github', {
         adapter: mockAdapter,
      })

      const req = {
         query: {
            code: 'code-123',
            redirect_uri: 'http://my-callback',
         },
      } as unknown as ApiRequest

      const res = {
         status: jest.fn().mockReturnThis(),
         json: jest.fn(),
      } as unknown as ApiResponse

      await routes['/callback'](req, res)

      expect(mockAdapter.exchangeCodeForToken).toHaveBeenCalledWith('code-123', 'http://my-callback')
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ access_token: 'token-abc' })
   })

    it('should redirect to deep link for mobile platform', async () => {
       GithubAuthApi(mockRouter as unknown as ServerAdapter, '/api/auth/github', {
          adapter: mockAdapter,
          appScheme: 'myapp',
       })

       const req = {
          query: {
             code: 'code-123',
          },
       } as unknown as ApiRequest

       const res = {
          status: jest.fn().mockReturnThis(),
          setHeader: jest.fn().mockReturnThis(),
          send: jest.fn(),
       } as unknown as ApiResponse

       await routes['/callback'](req, res)

       expect(res.status).toHaveBeenCalledWith(302)
       expect(res.setHeader).toHaveBeenCalledWith(
          'Location',
          'myapp://auth/github/callback?token=token-abc'
       )
    })

    it('should redirect to web URL if webRedirectUri is configured', async () => {
       GithubAuthApi(mockRouter as unknown as ServerAdapter, '/api/auth/github', {
          adapter: mockAdapter,
          webRedirectUri: 'http://localhost:3000/settings?tab=sync',
       })

       const req = {
          query: {
             code: 'code-123',
          },
       } as unknown as ApiRequest

       const res = {
          status: jest.fn().mockReturnThis(),
          setHeader: jest.fn().mockReturnThis(),
          send: jest.fn(),
       } as unknown as ApiResponse

       await routes['/callback'](req, res)

       expect(res.status).toHaveBeenCalledWith(302)
       expect(res.setHeader).toHaveBeenCalledWith(
          'Location',
          'http://localhost:3000/settings?tab=sync&token=token-abc'
       )
    })
})
