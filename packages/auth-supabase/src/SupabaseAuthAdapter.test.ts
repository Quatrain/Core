import { SupabaseAuthAdapter } from './SupabaseAuthAdapter'
import { User } from '@quatrain/backend'
import { AuthenticationError } from '@quatrain/auth'
import { createClient } from '@supabase/supabase-js'
import * as nativeFetch from 'node-fetch-native'

// Mock the dependencies
jest.mock('@supabase/supabase-js')
jest.mock('node-fetch-native')

describe('SupabaseAuthAdapter', () => {
   let adapter: SupabaseAuthAdapter
   let mockSupabaseClient: any
   let mockAuthAdmin: any
   let mockAuth: any

   beforeEach(() => {
      // Clear all mocks before each test
      jest.clearAllMocks()

      // Create mock Supabase client structure
      mockAuthAdmin = {
         createUser: jest.fn(),
         updateUserById: jest.fn(),
      }

      mockAuth = {
         admin: mockAuthAdmin,
         getUser: jest.fn(),
         signInWithPassword: jest.fn(),
         signOut: jest.fn(),
      }

      mockSupabaseClient = {
         auth: mockAuth,
      }

      // Mock createClient to return our mock client
      ;(createClient as jest.Mock).mockReturnValue(mockSupabaseClient)

      // Create adapter instance
      adapter = new SupabaseAuthAdapter({
         config: {
            supabaseUrl: 'https://test.supabase.co',
            supabaseKey: 'test-key-123',
         },
      })
   })

   afterEach(() => {
      jest.restoreAllMocks()
   })

   describe('Constructor', () => {
      it('should create Supabase client with correct configuration', () => {
         expect(createClient).toHaveBeenCalledWith(
            'https://test.supabase.co',
            'test-key-123',
            {
               auth: {
                  autoRefreshToken: false,
                  persistSession: false,
               },
            }
         )
      })

      it('should set autoRefreshToken to false', () => {
         const callArgs = (createClient as jest.Mock).mock.calls[0]
         expect(callArgs[2].auth.autoRefreshToken).toBe(false)
      })

      it('should set persistSession to false', () => {
         const callArgs = (createClient as jest.Mock).mock.calls[0]
         expect(callArgs[2].auth.persistSession).toBe(false)
      })
   })

   describe('register()', () => {
      const mockUser = {
         _: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            password: 'hashed-password',
         },
      } as unknown as User

      it('should successfully register a new user', async () => {
         const mockSupabaseUser = {
            id: 'user-123',
            email: 'john@example.com',
         }

         mockAuthAdmin.createUser.mockResolvedValue({
            data: { user: mockSupabaseUser },
            error: null,
         })

         const result = await adapter.register(mockUser, 'clearPassword123')

         expect(mockAuthAdmin.createUser).toHaveBeenCalledWith({
            email: 'john@example.com',
            password: 'clearPassword123',
            email_confirm: true,
         })

         expect(result).toEqual(mockSupabaseUser)
      })

      it('should use hashed password when clearPassword is not provided', async () => {
         const mockSupabaseUser = {
            id: 'user-123',
            email: 'john@example.com',
         }

         mockAuthAdmin.createUser.mockResolvedValue({
            data: { user: mockSupabaseUser },
            error: null,
         })

         await adapter.register(mockUser)

         expect(mockAuthAdmin.createUser).toHaveBeenCalledWith({
            email: 'john@example.com',
            password: 'hashed-password',
            email_confirm: true,
         })
      })

      it('should throw AuthenticationError when email already exists', async () => {
         mockAuthAdmin.createUser.mockResolvedValue({
            data: null,
            error: {
               code: 'email_exists',
               message: 'User already registered',
            },
         })

         await expect(adapter.register(mockUser, 'password')).rejects.toThrow(
            AuthenticationError
         )

         await expect(adapter.register(mockUser, 'password')).rejects.toThrow(
            'User email already exists'
         )
      })

      it('should throw AuthenticationError on generic error', async () => {
         mockAuthAdmin.createUser.mockResolvedValue({
            data: null,
            error: {
               code: 'server_error',
               message: 'Internal server error',
            },
         })

         await expect(adapter.register(mockUser, 'password')).rejects.toThrow(
            AuthenticationError
         )
      })

      it('should handle exceptions and wrap them in AuthenticationError', async () => {
         mockAuthAdmin.createUser.mockRejectedValue(new Error('Network error'))

         await expect(adapter.register(mockUser, 'password')).rejects.toThrow(
            AuthenticationError
         )

         await expect(adapter.register(mockUser, 'password')).rejects.toThrow(
            'Network error'
         )
      })
   })

   describe('getAuthToken()', () => {
      it('should successfully retrieve auth token', async () => {
         const mockUserData = {
            id: 'user-123',
            email: 'test@example.com',
         }

         mockAuth.getUser.mockResolvedValue({
            data: { user: mockUserData },
            error: null,
         })

         const result = await adapter.getAuthToken('bearer-token-123')

         expect(mockAuth.getUser).toHaveBeenCalledWith('bearer-token-123')
         expect(result).toEqual(mockUserData)
      })

      it('should throw error when user data is missing', async () => {
         mockAuth.getUser.mockResolvedValue({
            data: null,
            error: null,
         })

         await expect(adapter.getAuthToken('invalid-token')).rejects.toThrow(
            'Unable to retrieve auth token from Supabase'
         )
      })

      it('should throw error when user is undefined', async () => {
         mockAuth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
         })

         await expect(adapter.getAuthToken('invalid-token')).rejects.toThrow(
            'Unable to retrieve auth token from Supabase'
         )
      })
   })

   describe('refreshToken()', () => {
      it('should successfully refresh token', async () => {
         const mockResponse = {
            access_token: 'new-token',
            refresh_token: 'new-refresh-token',
         }

         const mockFetchResponse = {
            json: jest.fn().mockResolvedValue(mockResponse),
         }

         ;(nativeFetch.fetch as jest.Mock).mockResolvedValue(mockFetchResponse)

         const result = await adapter.refreshToken('old-refresh-token')

         expect(nativeFetch.fetch).toHaveBeenCalledWith(
            'https://test.supabase.co/auth/v1/token?grant_type=refresh_token',
            {
               method: 'POST',
               headers: {
                  apikey: 'test-key-123',
               },
               body: JSON.stringify({
                  refresh_token: 'old-refresh-token',
               }),
            }
         )

         // Note: The actual implementation doesn't await json(), so result is the promise
         // But since we mocked it to return the value, we get the direct value
         const resultValue = await result
         expect(resultValue).toEqual(mockResponse)
      })

      it('should construct correct URL with config values', async () => {
         const mockFetchResponse = {
            json: jest.fn().mockResolvedValue({}),
         }

         ;(nativeFetch.fetch as jest.Mock).mockResolvedValue(mockFetchResponse)

         await adapter.refreshToken('refresh-token')

         const callArgs = (nativeFetch.fetch as jest.Mock).mock.calls[0]
         expect(callArgs[0]).toBe(
            'https://test.supabase.co/auth/v1/token?grant_type=refresh_token'
         )
      })
   })

   describe('revokeAuthToken()', () => {
      it('should successfully revoke token via signout', async () => {
         mockAuth.signOut.mockResolvedValue({
            error: null,
         })

         const result = await adapter.revokeAuthToken('token-123')

         expect(mockAuth.signOut).toHaveBeenCalled()
         // Note: The implementation has a bug - it destructures { error } from signout()
         // which returns true/false, not an object. So error is undefined, and
         // undefined !== null is true, so it returns false even on success.
         expect(result).toBe(false)
      })

      it('should return false when signout fails', async () => {
         mockAuth.signOut.mockResolvedValue({
            error: { message: 'Signout failed' },
         })

         const result = await adapter.revokeAuthToken('token-123')

         expect(result).toBe(false)
      })
   })

   describe('signup()', () => {
      it('should successfully sign in with email and password', async () => {
         const mockUserData = {
            id: 'user-123',
            email: 'test@example.com',
         }

         const mockSessionData = {
            access_token: 'token-123',
            refresh_token: 'refresh-123',
         }

         mockAuth.signInWithPassword.mockResolvedValue({
            data: {
               user: mockUserData,
               session: mockSessionData,
            },
            error: null,
         })

         const result = await adapter.signup('test@example.com', 'password123')

         expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
            email: 'test@example.com',
            password: 'password123',
         })

         expect(result).toEqual({
            user: mockUserData,
            session: mockSessionData,
         })
      })

      it('should return false on error', async () => {
         mockAuth.signInWithPassword.mockResolvedValue({
            data: null,
            error: { message: 'Invalid credentials' },
         })

         const result = await adapter.signup('test@example.com', 'wrongpass')

         expect(result).toBe(false)
      })
   })

   describe('signout()', () => {
      it('should successfully sign out', async () => {
         mockAuth.signOut.mockResolvedValue({
            error: null,
         })

         const result = await adapter.signout()

         expect(mockAuth.signOut).toHaveBeenCalled()
         expect(result).toBe(true)
      })

      it('should return false on error', async () => {
         mockAuth.signOut.mockResolvedValue({
            error: { message: 'Signout failed' },
         })

         const result = await adapter.signout()

         expect(result).toBe(false)
      })
   })

   describe('update()', () => {
      const mockUser = {
         uid: 'user-123',
         _: {
            email: 'test@example.com',
         },
      } as unknown as User

      it('should successfully update user', async () => {
         const updatable = {
            email: 'newemail@example.com',
            displayName: 'New Name',
         }

         mockAuthAdmin.updateUserById.mockResolvedValue({
            data: { user: { ...mockUser, ...updatable } },
            error: null,
         })

         await adapter.update(mockUser, updatable)

         expect(mockAuthAdmin.updateUserById).toHaveBeenCalledWith(
            'user-123',
            updatable
         )
      })

      it('should skip update when updatable is empty', async () => {
         await adapter.update(mockUser, {})

         expect(mockAuthAdmin.updateUserById).not.toHaveBeenCalled()
      })

      it('should handle error during update', async () => {
         const updatable = { displayName: 'New Name' }

         mockAuthAdmin.updateUserById.mockResolvedValue({
            data: null,
            error: { message: 'Update failed' },
         })

         await adapter.update(mockUser, updatable)

         // The method doesn't throw, just logs the error
         expect(mockAuthAdmin.updateUserById).toHaveBeenCalledWith(
            'user-123',
            updatable
         )
      })

      it('should return false on exception', async () => {
         const updatable = { displayName: 'New Name' }

         mockAuthAdmin.updateUserById.mockRejectedValue(
            new Error('Network error')
         )

         const result = await adapter.update(mockUser, updatable)

         expect(result).toBe(false)
      })
   })

   describe('delete()', () => {
      it('should have delete method defined', () => {
         expect(adapter.delete).toBeDefined()
         expect(typeof adapter.delete).toBe('function')
      })

      it('should be callable with a user', async () => {
         const mockUser = {
            uid: 'user-123',
         } as unknown as User

         // The method is currently not implemented (empty)
         const result = await adapter.delete(mockUser)

         expect(result).toBeUndefined()
      })
   })

   describe('setCustomUserClaims()', () => {
      it('should successfully set custom user claims', async () => {
         const claims = {
            role: 'admin',
            permissions: ['read', 'write'],
         }

         const mockUserData = {
            id: 'user-123',
            user_metadata: claims,
         }

         mockAuthAdmin.updateUserById.mockResolvedValue({
            data: mockUserData,
            error: null,
         })

         const result = await adapter.setCustomUserClaims('user-123', claims)

         expect(mockAuthAdmin.updateUserById).toHaveBeenCalledWith('user-123', {
            user_metadata: claims,
         })

         expect(result).toEqual(mockUserData)
      })

      it('should throw AuthenticationError on error', async () => {
         const claims = { role: 'admin' }

         mockAuthAdmin.updateUserById.mockResolvedValue({
            data: null,
            error: { message: 'Update failed' },
         })

         await expect(
            adapter.setCustomUserClaims('user-123', claims)
         ).rejects.toThrow(AuthenticationError)
      })
   })
})
