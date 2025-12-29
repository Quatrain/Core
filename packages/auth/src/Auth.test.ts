import { Auth, AuthAction, AuthParameters } from './Auth'
import { MockAuthAdapter } from './MockAuthAdapter'
import { User } from '@quatrain/backend'

describe('Auth', () => {
   let mockAdapter1: MockAuthAdapter
   let mockAdapter2: MockAuthAdapter

   beforeEach(() => {
      // Reset providers before each test
      ;(Auth as any)._providers = {}
      Auth.defaultProvider = 'default'

      // Create fresh mock adapters
      mockAdapter1 = new MockAuthAdapter({ debug: false })
      mockAdapter2 = new MockAuthAdapter({ debug: false })
   })

   afterEach(() => {
      // Clean up
      mockAdapter1?.clearAll()
      mockAdapter2?.clearAll()
   })

   describe('AuthAction enum', () => {
      it('should have correct action values', () => {
         expect(AuthAction.SIGNIN).toBe('signin')
         expect(AuthAction.SIGNUP).toBe('signup')
         expect(AuthAction.SIGNOUT).toBe('signout')
      })
   })

   describe('addProvider', () => {
      it('should add a provider with an alias', () => {
         Auth.addProvider(mockAdapter1, 'test-provider')

         const provider = Auth.getProvider('test-provider')
         expect(provider).toBe(mockAdapter1)
      })

      it('should add multiple providers with different aliases', () => {
         Auth.addProvider(mockAdapter1, 'provider1')
         Auth.addProvider(mockAdapter2, 'provider2')

         const provider1 = Auth.getProvider('provider1')
         const provider2 = Auth.getProvider('provider2')

         expect(provider1).toBe(mockAdapter1)
         expect(provider2).toBe(mockAdapter2)
      })

      it('should set default provider when setDefault is true', () => {
         Auth.addProvider(mockAdapter1, 'custom-provider', true)

         expect(Auth.defaultProvider).toBe('custom-provider')
         const provider = Auth.getProvider() // Should use default
         expect(provider).toBe(mockAdapter1)
      })

      it('should not change default provider when setDefault is false', () => {
         const originalDefault = Auth.defaultProvider
         Auth.addProvider(mockAdapter1, 'custom-provider', false)

         expect(Auth.defaultProvider).toBe(originalDefault)
      })

      it('should allow overriding an existing provider', () => {
         Auth.addProvider(mockAdapter1, 'provider')
         Auth.addProvider(mockAdapter2, 'provider')

         const provider = Auth.getProvider('provider')
         expect(provider).toBe(mockAdapter2)
      })
   })

   describe('getProvider', () => {
      it('should return the correct provider by alias', () => {
         Auth.addProvider(mockAdapter1, 'test-provider')

         const provider = Auth.getProvider('test-provider')
         expect(provider).toBe(mockAdapter1)
      })

      it('should return the default provider when no alias is specified', () => {
         Auth.addProvider(mockAdapter1, 'default', true)

         const provider = Auth.getProvider()
         expect(provider).toBe(mockAdapter1)
      })

      it('should throw error when provider alias does not exist', () => {
         expect(() => {
            Auth.getProvider('non-existent')
         }).toThrow("Unknown provider alias: 'non-existent'")
      })

      it('should throw error when getting default provider that does not exist', () => {
         expect(() => {
            Auth.getProvider()
         }).toThrow("Unknown provider alias: 'default'")
      })

      it('should be type-safe with generic parameter', () => {
         Auth.addProvider(mockAdapter1, 'typed-provider')

         const provider = Auth.getProvider<MockAuthAdapter>('typed-provider')
         expect(provider).toBeInstanceOf(MockAuthAdapter)
      })
   })

   describe('defaultProvider', () => {
      it('should have a default value of "default"', () => {
         expect(Auth.defaultProvider).toBe('default')
      })

      it('should allow changing the default provider', () => {
         Auth.addProvider(mockAdapter1, 'new-default', true)
         expect(Auth.defaultProvider).toBe('new-default')
      })
   })

   describe('ERROR_EMAIL_EXISTS constant', () => {
      it('should have correct error message', () => {
         expect(Auth.ERROR_EMAIL_EXISTS).toBe('User email already exists')
      })
   })

   describe('Integration with MockAuthAdapter', () => {
      it('should work with adapter methods', async () => {
         Auth.addProvider(mockAdapter1, 'test')
         const provider = Auth.getProvider<MockAuthAdapter>('test')

         const mockUser = {
            _: { email: 'test@example.com' },
            name: 'Test User',
         } as unknown as User

         const result = await provider.register(mockUser, 'password123')
         expect(result.success).toBe(true)
         expect(result.user._.email).toBe('test@example.com')
      })

      it('should maintain separate state between providers', async () => {
         Auth.addProvider(mockAdapter1, 'provider1')
         Auth.addProvider(mockAdapter2, 'provider2')

         const adapter1 = Auth.getProvider<MockAuthAdapter>('provider1')
         const adapter2 = Auth.getProvider<MockAuthAdapter>('provider2')

         const user1 = {
            _: { email: 'user1@example.com' },
            name: 'User 1',
         } as unknown as User
         const user2 = {
            _: { email: 'user2@example.com' },
            name: 'User 2',
         } as unknown as User

         await adapter1.register(user1, 'password1')
         await adapter2.register(user2, 'password2')

         expect(adapter1.getUserByEmail('user1@example.com')).toBeDefined()
         expect(adapter1.getUserByEmail('user2@example.com')).toBeUndefined()

         expect(adapter2.getUserByEmail('user2@example.com')).toBeDefined()
         expect(adapter2.getUserByEmail('user1@example.com')).toBeUndefined()
      })
   })

   describe('AuthParameters', () => {
      it('should accept valid parameters when creating adapter', () => {
         const params: AuthParameters = {
            host: 'https://auth.example.com',
            alias: 'example-auth',
            debug: true,
            config: { timeout: 5000 },
            fixtures: { users: [] },
         }

         const adapter = new MockAuthAdapter(params)
         expect(adapter.getParam('host')).toBe('https://auth.example.com')
         expect(adapter.getParam('debug')).toBe(true)
         expect(adapter.getParam('config')).toEqual({ timeout: 5000 })
      })

      it('should work with empty parameters', () => {
         const adapter = new MockAuthAdapter()
         expect(adapter.getParam('host')).toBeUndefined()
         expect(adapter.getParam('debug')).toBeUndefined()
      })
   })

   describe('Provider registry behavior', () => {
      it('should maintain providers across multiple operations', () => {
         Auth.addProvider(mockAdapter1, 'persistent')

         // Multiple get operations
         const provider1 = Auth.getProvider('persistent')
         const provider2 = Auth.getProvider('persistent')

         expect(provider1).toBe(provider2)
         expect(provider1).toBe(mockAdapter1)
      })

      it('should handle switching default provider multiple times', () => {
         Auth.addProvider(mockAdapter1, 'provider1', true)
         expect(Auth.defaultProvider).toBe('provider1')

         Auth.addProvider(mockAdapter2, 'provider2', true)
         expect(Auth.defaultProvider).toBe('provider2')

         const defaultProvider = Auth.getProvider()
         expect(defaultProvider).toBe(mockAdapter2)
      })
   })
})
