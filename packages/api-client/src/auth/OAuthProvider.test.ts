import { OAuthProvider } from './OAuthProvider'

describe('OAuthProvider', () => {
   it('should generate headers using access token resolved via fetcher callback', async () => {
      const mockFetcher = jest.fn().mockResolvedValue('oauth-token')
      const provider = new OAuthProvider(mockFetcher)
      
      const headers = await provider.getHeaders()
      expect(mockFetcher).toHaveBeenCalledTimes(1)
      expect(headers).toBeDefined()
      expect(headers.Authorization).toBe('Bearer oauth-token')
   })
})
