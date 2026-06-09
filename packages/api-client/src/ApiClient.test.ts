import { ApiClient, Method } from './ApiClient'
import { AuthProvider } from './auth/AuthProvider'
import { Log } from '@quatrain/log'

// Mock global fetch
const globalFetch = global.fetch

describe('ApiClient', () => {
   let fetchMock: jest.Mock

   beforeEach(() => {
      fetchMock = jest.fn()
      global.fetch = fetchMock
      // Reset ApiClient static debug mode if changed
      ApiClient.debug = false
   })

   afterAll(() => {
      global.fetch = globalFetch
   })

   it('should manage instances correctly', () => {
      const client1 = ApiClient.instance('https://api.example.com', 'default')
      expect(client1).toBeDefined()
      
      const client2 = ApiClient.instance('https://api.example.com', 'default')
      expect(client2).toBe(client1)
      
      const client3 = ApiClient.instance('https://api.example.com', 'other')
      expect(client3).not.toBe(client1)
   })

   it('should stub cache methods', () => {
      const key = 'test-key'
      expect(ApiClient.cache(key)).toBe(false)
      
      const data = { foo: 'bar' }
      expect(ApiClient.cache(key, data)).toBe(data)
      
      // cache removal magic string calls invalidate (stub)
      const spyInvalidate = jest.spyOn(ApiClient, 'invalidate').mockImplementation(() => {})
      ApiClient.cache(key, ApiClient.CACHE_REMOVE)
      expect(spyInvalidate).toHaveBeenCalledWith(key)
      spyInvalidate.mockRestore()
   })

   it('should generate cache key correctly', () => {
      const key = ApiClient.getCacheKey('users', { limit: 10 })
      expect(key).toContain('api-users')
      expect(key).toContain('limit')
   })

   it('should call stub invalidate method without error', () => {
      expect(() => ApiClient.invalidate('prefix')).not.toThrow()
   })

   it('should dispatch POST request correctly', async () => {
      const responsePayload = { results: [{ uid: '123', name: 'John' }] }
      fetchMock.mockResolvedValueOnce({
         ok: true,
         status: 201,
         json: async () => responsePayload,
      })

      const client = new ApiClient('https://api.example.com')
      const result = await client.post('users', { name: 'John' })

      expect(fetchMock).toHaveBeenCalledWith(
         'https://api.example.com/users',
         expect.objectContaining({
            method: Method.POST,
            body: JSON.stringify({ name: 'John' }),
            headers: expect.objectContaining({
               'Content-Type': 'application/json',
            }),
         })
      )
      expect(result.status).toBe(201)
      expect(result.data).toEqual([{ uid: '123', name: 'John' }])
   })

   it('should dispatch PATCH request correctly', async () => {
      const responsePayload = { name: 'Updated' }
      fetchMock.mockResolvedValueOnce({
         ok: true,
         status: 200,
         json: async () => responsePayload,
      })

      const client = new ApiClient('https://api.example.com')
      const result = await client.patch('users/123', { name: 'Updated' })

      expect(fetchMock).toHaveBeenCalledWith(
         'https://api.example.com/users/123',
         expect.objectContaining({
            method: Method.PATCH,
            body: JSON.stringify({ name: 'Updated' }),
         })
      )
      expect(result.data).toEqual({ name: 'Updated' })
   })

   it('should dispatch PUT request correctly', async () => {
      const responsePayload = { name: 'Replaced' }
      fetchMock.mockResolvedValueOnce({
         ok: true,
         status: 200,
         json: async () => responsePayload,
      })

      const client = new ApiClient('https://api.example.com')
      const result = await client.put('users/123', { name: 'Replaced' })

      expect(result.data).toEqual({ name: 'Replaced' })
   })

   it('should dispatch DELETE request correctly', async () => {
      fetchMock.mockResolvedValueOnce({
         ok: true,
         status: 204,
         json: async () => null,
      })

      const client = new ApiClient('https://api.example.com')
      const result = await client.delete('users/123', {})

      expect(result.status).toBe(204)
   })

   it('should dispatch GET request with search parameters and map objectId to uid', async () => {
      const responsePayload = {
         results: [{ objectId: '456', name: 'Jane' }],
         meta: { total: 1 },
      }
      fetchMock.mockResolvedValueOnce({
         ok: true,
         status: 200,
         json: async () => responsePayload,
      })

      const client = new ApiClient('https://api.example.com')
      const result = await client.get('users', {
         where: { status: 'active' },
         offset: 5,
         batch: 10,
      })

      expect(fetchMock).toHaveBeenCalledWith(
         expect.stringContaining('https://api.example.com/users?where=%7B%22status%22%3A%22active%22%7D&offset=5&batch=10'),
         expect.objectContaining({
            method: Method.GET,
         })
      )
      expect(result.data).toEqual([{ uid: '456', name: 'Jane' }])
      expect(result.meta).toEqual({ total: 1 })
   })

   it('should support full URL paths and headers from AuthProvider', async () => {
      fetchMock.mockResolvedValueOnce({
         ok: true,
         status: 200,
         json: async () => ({ results: [] }),
      })

      const mockAuthProvider: AuthProvider = {
         getHeaders: async () => ({ Authorization: 'Bearer test-token' }),
      }

      const client = new ApiClient('https://api.example.com', 'auth-client', mockAuthProvider)
      await client.get('https://other-domain.com/data', {
         headers: { 'X-Custom': 'Value' },
      })

      expect(fetchMock).toHaveBeenCalledWith(
         'https://other-domain.com/data',
         expect.objectContaining({
            headers: expect.objectContaining({
               'Content-Type': 'application/json',
               Authorization: 'Bearer test-token',
               'X-Custom': 'Value',
            }),
         })
      )
   })

   it('should update AuthProvider dynamically using setAuthProvider', async () => {
      fetchMock.mockResolvedValueOnce({
         ok: true,
         status: 200,
         json: async () => ({ results: [] }),
      })

      const mockAuthProvider: AuthProvider = {
         getHeaders: async () => ({ Authorization: 'Bearer test-token' }),
      }

      const client = new ApiClient('https://api.example.com')
      client.setAuthProvider(mockAuthProvider)
      await client.get('data')

      expect(fetchMock).toHaveBeenCalledWith(
         'https://api.example.com/data',
         expect.objectContaining({
            headers: expect.objectContaining({
               Authorization: 'Bearer test-token',
            }),
         })
      )
   })

   it('should handle API errors by reading the JSON error response', async () => {
      fetchMock.mockResolvedValueOnce({
         ok: false,
         status: 400,
         statusText: 'Bad Request',
         json: async () => ({ error: 'InvalidPayload', message: 'Missing fields' }),
      })

      const client = new ApiClient('https://api.example.com')
      await expect(client.get('data')).rejects.toThrow('InvalidPayload: Missing fields')
   })

   it('should handle API errors with generic message when error field is missing', async () => {
      fetchMock.mockResolvedValueOnce({
         ok: false,
         status: 403,
         statusText: 'Forbidden',
         json: async () => ({ message: 'Rate limit exceeded' }),
      })

      const client = new ApiClient('https://api.example.com')
      await expect(client.get('data')).rejects.toThrow('Rate limit exceeded')
   })

   it('should fallback to status details when json parsing fails in error response', async () => {
      fetchMock.mockResolvedValueOnce({
         ok: false,
         status: 500,
         statusText: 'Internal Server Error',
         json: async () => {
            throw new Error('Not JSON')
         },
      })

      const client = new ApiClient('https://api.example.com')
      await expect(client.get('data')).rejects.toThrow('API Error: 500 Internal Server Error')
   })

   it('should rethrow network/fetch errors after logging them', async () => {
      const networkError = new TypeError('Failed to fetch')
      fetchMock.mockRejectedValueOnce(networkError)

      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})

      const client = new ApiClient('https://api.example.com')
      await expect(client.get('data')).rejects.toThrow('Failed to fetch')

      expect(debugSpy).toHaveBeenCalled()
      debugSpy.mockRestore()
   })

   it('should log detailed response messages under debug mode', async () => {
      ApiClient.debug = true
      fetchMock.mockResolvedValueOnce({
         ok: true,
         status: 200,
         json: async () => ({ items: 'raw-value' }),
      })

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      const client = new ApiClient('https://api.example.com')
      const result = await client.get('data')

      expect(logSpy).toHaveBeenCalledWith(
         expect.stringContaining('API: [200] GET https://api.example.com/data')
      )
      expect(result.data).toBe('raw-value')
      logSpy.mockRestore()
   })
})
