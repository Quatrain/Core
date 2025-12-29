import { AbstractAuthAdapter } from './AbstractAuthAdapter'
import { User } from '@quatrain/backend'
import { AuthParameters } from './Auth'

/**
 * Mock Authentication Adapter for testing purposes
 */
export class MockAuthAdapter extends AbstractAuthAdapter {
   private registeredUsers: Map<string, User> = new Map()
   private tokens: Map<string, any> = new Map()
   private refreshTokens: Map<string, string> = new Map()

   constructor(params: AuthParameters = {}) {
      super(params)
   }

   async register(user: User, clearPassword?: string): Promise<any> {
      if (this.registeredUsers.has(user._.email)) {
         throw new Error('User email already exists')
      }
      this.registeredUsers.set(user._.email, user)
      return { success: true, user }
   }

   async signup(login: string, password: string): Promise<any> {
      const user = this.registeredUsers.get(login)
      if (!user) {
         throw new Error('User not found')
      }

      const token = `mock-token-${Date.now()}`
      const refreshToken = `mock-refresh-token-${Date.now()}`

      this.tokens.set(token, { user, timestamp: Date.now() })
      this.refreshTokens.set(refreshToken, token)

      return {
         success: true,
         token,
         refreshToken,
         user,
      }
   }

   async signout(user: User): Promise<any> {
      // Remove all tokens associated with this user
      for (const [token, data] of this.tokens.entries()) {
         if (data.user._.email === user._.email) {
            this.tokens.delete(token)
         }
      }
      return { success: true }
   }

   async update(user: User, updatable: any): Promise<any> {
      const existingUser = this.registeredUsers.get(user._.email)
      if (!existingUser) {
         throw new Error('User not found')
      }

      const updatedUser = { ...existingUser, ...updatable }
      this.registeredUsers.set(user._.email, updatedUser)

      return { success: true, user: updatedUser }
   }

   async delete(user: User): Promise<any> {
      if (!this.registeredUsers.has(user._.email)) {
         throw new Error('User not found')
      }

      this.registeredUsers.delete(user._.email)
      await this.signout(user)

      return { success: true }
   }

   getAuthToken(token: string): any {
      const tokenData = this.tokens.get(token)
      if (!tokenData) {
         throw new Error('Invalid token')
      }
      return tokenData
   }

   async refreshToken(refreshToken: string): Promise<any> {
      const oldToken = this.refreshTokens.get(refreshToken)
      if (!oldToken) {
         throw new Error('Invalid refresh token')
      }

      const tokenData = this.tokens.get(oldToken)
      if (!tokenData) {
         throw new Error('Token not found')
      }

      // Generate new tokens
      const newToken = `mock-token-${Date.now()}`
      const newRefreshToken = `mock-refresh-token-${Date.now()}`

      // Remove old tokens
      this.tokens.delete(oldToken)
      this.refreshTokens.delete(refreshToken)

      // Add new tokens
      this.tokens.set(newToken, tokenData)
      this.refreshTokens.set(newRefreshToken, newToken)

      return {
         success: true,
         token: newToken,
         refreshToken: newRefreshToken,
      }
   }

   revokeAuthToken(token: string): any {
      if (!this.tokens.has(token)) {
         throw new Error('Token not found')
      }

      this.tokens.delete(token)

      // Remove associated refresh token
      for (const [
         refreshToken,
         associatedToken,
      ] of this.refreshTokens.entries()) {
         if (associatedToken === token) {
            this.refreshTokens.delete(refreshToken)
            break
         }
      }

      return { success: true }
   }

   setCustomUserClaims(id: string, claims: any): any {
      // Find user by id and set custom claims
      for (const [email, user] of this.registeredUsers.entries()) {
         if ((user as any)._.id === id) {
            ;(user as any).customClaims = claims
            return { success: true, claims }
         }
      }
      throw new Error('User not found')
   }

   // Helper methods for testing
   clearAll(): void {
      this.registeredUsers.clear()
      this.tokens.clear()
      this.refreshTokens.clear()
   }

   getUserByEmail(email: string): User | undefined {
      return this.registeredUsers.get(email)
   }

   hasToken(token: string): boolean {
      return this.tokens.has(token)
   }
}
