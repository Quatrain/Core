import { FirebaseAuthAdapter } from './FirebaseAuthAdapter'
import { User } from '@quatrain/backend'
import { AuthenticationError } from '@quatrain/auth'
import { getAuth } from 'firebase-admin/auth'
import { getApps, initializeApp } from 'firebase-admin/app'
import * as nativeFetch from 'node-fetch-native'

// Mock the dependencies
jest.mock('firebase-admin/auth')
jest.mock('firebase-admin/app')
jest.mock('node-fetch-native')

describe('FirebaseAuthAdapter', () => {
   let adapter: FirebaseAuthAdapter
   let mockAuth: any

   beforeEach(() => {
      // Clear all mocks before each test
      jest.clearAllMocks()

      // Mock Firebase Admin SDK
      mockAuth = {
         createUser: jest.fn(),
         verifyIdToken: jest.fn(),
         updateUser: jest.fn(),
         deleteUser: jest.fn(),
      }
      ;(getAuth as jest.Mock).mockReturnValue(mockAuth)
      ;(getApps as jest.Mock).mockReturnValue([])

      // Create adapter instance
      adapter = new FirebaseAuthAdapter({
         config: {
            projectId: 'test-project',
            apiKey: 'test-api-key',
         },
      })
   })

   afterEach(() => {
      jest.restoreAllMocks()
   })

   describe('Constructor', () => {
      it('should initialize Firebase app when no apps exist', () => {
         expect(getApps).toHaveBeenCalled()
         expect(initializeApp).toHaveBeenCalledWith({
            projectId: 'test-project',
            apiKey: 'test-api-key',
         })
      })

      it('should not initialize Firebase app when app already exists', () => {
         ;(getApps as jest.Mock).mockReturnValue([{ name: 'existing-app' }])

         new FirebaseAuthAdapter({
            config: {
               projectId: 'test-project',
            },
         })

         // initializeApp should still be called once from the first adapter creation
         expect(initializeApp).toHaveBeenCalledTimes(1)
      })
   })

   describe('register()', () => {
      const mockUser = {
         uid: 'user-123',
         _: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            password: 'hashed-password',
            disabled: false,
         },
      } as unknown as User

      it('should successfully register a new user', async () => {
         const mockUserRecord = {
            uid: 'user-123',
            email: 'john@example.com',
         }

         mockAuth.createUser.mockResolvedValue(mockUserRecord)

         const result = await adapter.register(mockUser, 'clearPassword123')

         expect(mockAuth.createUser).toHaveBeenCalledWith({
            uid: 'user-123',
            email: 'john@example.com',
            phoneNumber: '+1234567890',
            password: 'clearPassword123',
            disabled: false,
            displayName: 'John Doe',
         })

         expect(result).toBe('user-123')
      })

      it('should use hashed password when clearPassword is not provided', async () => {
         const mockUserRecord = {
            uid: 'user-123',
            email: 'john@example.com',
         }

         mockAuth.createUser.mockResolvedValue(mockUserRecord)

         await adapter.register(mockUser)

         expect(mockAuth.createUser).toHaveBeenCalledWith({
            uid: 'user-123',
            email: 'john@example.com',
            phoneNumber: '+1234567890',
            password: 'hashed-password',
            disabled: false,
            displayName: 'John Doe',
         })
      })

      it('should handle user with default disabled value', async () => {
         const userWithoutDisabled = {
            uid: 'user-456',
            _: {
               name: 'Jane Doe',
               email: 'jane@example.com',
               phone: '+0987654321',
               password: 'password456',
            },
         } as unknown as User

         mockAuth.createUser.mockResolvedValue({ uid: 'user-456' })

         await adapter.register(userWithoutDisabled, 'password')

         const createUserCall = mockAuth.createUser.mock.calls[0][0]
         expect(createUserCall.disabled).toBe(false)
      })

      it('should throw AuthenticationError on Firebase error', async () => {
         mockAuth.createUser.mockRejectedValue(
            new Error('Email already exists')
         )

         await expect(adapter.register(mockUser, 'password')).rejects.toThrow(
            AuthenticationError
         )

         await expect(adapter.register(mockUser, 'password')).rejects.toThrow(
            'Email already exists'
         )
      })
   })

   describe('getAuthToken()', () => {
      it('should successfully verify auth token', async () => {
         const mockDecodedToken = {
            uid: 'user-123',
            email: 'test@example.com',
            iat: Date.now(),
         }

         mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken)

         const result = await adapter.getAuthToken('bearer-token-123')

         expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('bearer-token-123')
         expect(result).toEqual(mockDecodedToken)
      })

      it('should throw error when token is invalid', async () => {
         mockAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'))

         await expect(adapter.getAuthToken('invalid-token')).rejects.toThrow(
            'Invalid token'
         )
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

         mockAuth.updateUser.mockResolvedValue({})

         await adapter.update(mockUser, updatable)

         expect(mockAuth.updateUser).toHaveBeenCalledWith('user-123', updatable)
      })

      it('should skip update when updatable is empty', async () => {
         await adapter.update(mockUser, {})

         expect(mockAuth.updateUser).not.toHaveBeenCalled()
      })

      it('should silently handle errors during update', async () => {
         const updatable = { displayName: 'New Name' }

         mockAuth.updateUser.mockRejectedValue(new Error('Update failed'))

         // Should not throw
         await expect(
            adapter.update(mockUser, updatable)
         ).resolves.toBeUndefined()

         expect(mockAuth.updateUser).toHaveBeenCalledWith('user-123', updatable)
      })
   })

   describe('delete()', () => {
      const mockUser = {
         uid: 'user-123',
      } as unknown as User

      it('should successfully delete user', async () => {
         mockAuth.deleteUser.mockResolvedValue(undefined)

         await adapter.delete(mockUser)

         expect(mockAuth.deleteUser).toHaveBeenCalledWith('user-123')
      })

      it('should throw error on deletion failure', async () => {
         mockAuth.deleteUser.mockRejectedValue(new Error('User not found'))

         await expect(adapter.delete(mockUser)).rejects.toThrow(
            'User not found'
         )
      })
   })

   describe('refreshToken()', () => {
      it('should successfully refresh token', async () => {
         const mockResponse = {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
         }

         const mockFetchResponse = {
            json: jest.fn().mockResolvedValue(mockResponse),
         }

         ;(nativeFetch.fetch as jest.Mock).mockResolvedValue(mockFetchResponse)

         const result = await adapter.refreshToken('old-refresh-token')

         expect(nativeFetch.fetch).toHaveBeenCalledWith(
            'https://securetoken.googleapis.com/v1/token?key=test-api-key',
            {
               method: 'POST',
               body: JSON.stringify({
                  grant_type: 'refresh_token',
                  refresh_token: 'old-refresh-token',
               }),
               headers: { 'Content-Type': 'application/json' },
            }
         )

         // Note: Implementation doesn't await json(), so result is a promise
         const resultValue = await result
         expect(resultValue).toEqual(mockResponse)
      })

      it('should return empty object when API key is missing', async () => {
         const adapterWithoutKey = new FirebaseAuthAdapter({
            config: {
               projectId: 'test-project',
            },
         })

         const result = await adapterWithoutKey.refreshToken('refresh-token')

         expect(result).toEqual({})
         expect(nativeFetch.fetch).not.toHaveBeenCalled()
      })

      it('should construct correct URL with API key', async () => {
         const mockFetchResponse = {
            json: jest.fn().mockResolvedValue({}),
         }

         ;(nativeFetch.fetch as jest.Mock).mockResolvedValue(mockFetchResponse)

         await adapter.refreshToken('refresh-token')

         const callArgs = (nativeFetch.fetch as jest.Mock).mock.calls[0]
         expect(callArgs[0]).toBe(
            'https://securetoken.googleapis.com/v1/token?key=test-api-key'
         )
      })
   })

   describe('Unimplemented Methods (Stubs)', () => {
      describe('signup()', () => {
         it('should have signup method defined', () => {
            expect(adapter.signup).toBeDefined()
            expect(typeof adapter.signup).toBe('function')
         })

         it('should return undefined (not implemented)', async () => {
            const result = await adapter.signup('test@example.com', 'password')
            expect(result).toBeUndefined()
         })
      })

      describe('signout()', () => {
         it('should have signout method defined', () => {
            expect(adapter.signout).toBeDefined()
            expect(typeof adapter.signout).toBe('function')
         })

         it('should return undefined (not implemented)', async () => {
            const mockUser = { uid: 'user-123' } as unknown as User
            const result = await adapter.signout(mockUser)
            expect(result).toBeUndefined()
         })
      })

      describe('revokeAuthToken()', () => {
         it('should have revokeAuthToken method defined', () => {
            expect(adapter.revokeAuthToken).toBeDefined()
            expect(typeof adapter.revokeAuthToken).toBe('function')
         })

         it('should return undefined (not implemented)', async () => {
            const result = await adapter.revokeAuthToken('token-123')
            expect(result).toBeUndefined()
         })
      })

      describe('setCustomUserClaims()', () => {
         it('should have setCustomUserClaims method defined', () => {
            expect(adapter.setCustomUserClaims).toBeDefined()
            expect(typeof adapter.setCustomUserClaims).toBe('function')
         })

         it('should return undefined (not implemented)', async () => {
            const result = await adapter.setCustomUserClaims('user-123', {
               role: 'admin',
            })
            expect(result).toBeUndefined()
         })
      })
   })
})
