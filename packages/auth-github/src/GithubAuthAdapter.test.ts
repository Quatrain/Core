import { GithubAuthAdapter } from './GithubAuthAdapter'
import * as nativeFetch from 'node-fetch-native'

jest.mock('node-fetch-native')

describe('GithubAuthAdapter', () => {
   let adapter: GithubAuthAdapter

   beforeEach(() => {
      jest.clearAllMocks()

      adapter = new GithubAuthAdapter({
         config: {
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
         },
      })
   })

   describe('factory()', () => {
      it('should return null if clientId or clientSecret is missing', () => {
         expect(GithubAuthAdapter.factory({})).toBeNull()
         expect(GithubAuthAdapter.factory({ clientId: 'id' })).toBeNull()
         expect(GithubAuthAdapter.factory({ clientSecret: 'secret' })).toBeNull()
      })

      it('should return an instance if config is valid', () => {
         const instance = GithubAuthAdapter.factory({
            clientId: 'id',
            clientSecret: 'secret',
         })
         expect(instance).toBeInstanceOf(GithubAuthAdapter)
      })
   })

   describe('getAuthorizationUrl()', () => {
      it('should return correct authorization URL', () => {
         const url = adapter.getAuthorizationUrl(
            'http://callback',
            ['repo', 'user'],
            'state-123'
         )
         expect(url).toBe(
            'https://github.com/login/oauth/authorize?client_id=test-client-id&scope=repo%20user&redirect_uri=http%3A%2F%2Fcallback&state=state-123'
         )
      })
   })

   describe('exchangeCodeForToken()', () => {
      it('should exchange code for token successfully', async () => {
         const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({
               access_token: 'github-access-token-123',
               token_type: 'bearer',
               scope: 'repo',
            }),
         }
         ;(nativeFetch.fetch as jest.Mock).mockResolvedValue(mockResponse)

         const result = await adapter.exchangeCodeForToken('code-123', 'http://callback')
         expect(result.access_token).toBe('github-access-token-123')
         expect(nativeFetch.fetch).toHaveBeenCalledWith(
            'https://github.com/login/oauth/access_token',
            expect.objectContaining({
               method: 'POST',
               body: JSON.stringify({
                  client_id: 'test-client-id',
                  client_secret: 'test-client-secret',
                  code: 'code-123',
                  grant_type: 'authorization_code',
                  redirect_uri: 'http://callback',
               }),
            })
         )
      })

      it('should throw error on failed exchange request', async () => {
         const mockResponse = {
            ok: false,
            statusText: 'Bad Request',
         }
         ;(nativeFetch.fetch as jest.Mock).mockResolvedValue(mockResponse)

         await expect(
            adapter.exchangeCodeForToken('code-123')
         ).rejects.toThrow('OAuth token exchange failed: Bad Request')
      })
   })

   describe('getAuthToken()', () => {
      it('should fetch and return user profile information', async () => {
         const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({
               id: 9999,
               login: 'octocat',
               name: 'The Octocat',
            }),
         }
         ;(nativeFetch.fetch as jest.Mock).mockResolvedValue(mockResponse)

         const result = await adapter.getAuthToken('token-123')
         expect(result.login).toBe('octocat')
         expect(nativeFetch.fetch).toHaveBeenCalledWith(
            'https://api.github.com/user',
            expect.objectContaining({
               headers: {
                  'Authorization': 'Bearer token-123',
                  'Accept': 'application/json',
                  'User-Agent': 'Quatrain-Auth-Github',
               },
            })
         )
      })
   })

   describe('checkRepositoryExists()', () => {
      it('should return true if repo exists', async () => {
         const mockResponse = { status: 200 }
         ;(nativeFetch.fetch as jest.Mock).mockResolvedValue(mockResponse)

         const exists = await adapter.checkRepositoryExists('token-123', 'owner', 'repo')
         expect(exists).toBe(true)
         expect(nativeFetch.fetch).toHaveBeenCalledWith(
            'https://api.github.com/repos/owner/repo',
            expect.any(Object)
         )
      })

      it('should return false if repo does not exist', async () => {
         const mockResponse = { status: 404 }
         ;(nativeFetch.fetch as jest.Mock).mockResolvedValue(mockResponse)

         const exists = await adapter.checkRepositoryExists('token-123', 'owner', 'repo')
         expect(exists).toBe(false)
      })
   })

   describe('createRepository()', () => {
      it('should call GitHub user repos endpoint to create a repo', async () => {
         const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({
               id: 123456,
               name: 'new-repo',
               full_name: 'octocat/new-repo',
            }),
         }
         ;(nativeFetch.fetch as jest.Mock).mockResolvedValue(mockResponse)

         const result = await adapter.createRepository('token-123', 'new-repo', {
            private: true,
            description: 'My new repo',
         })

         expect(result.name).toBe('new-repo')
         expect(nativeFetch.fetch).toHaveBeenCalledWith(
            'https://api.github.com/user/repos',
            expect.objectContaining({
               method: 'POST',
               body: JSON.stringify({
                  name: 'new-repo',
                  private: true,
                  description: 'My new repo',
                  auto_init: true,
               }),
            })
         )
      })
   })
})
