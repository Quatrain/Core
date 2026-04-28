import { AbstractAuthAdapter, AuthParameters, AuthenticationError } from '@quatrain/auth'
import { User } from '@quatrain/backend'

export class PocketBaseAuthAdapter extends AbstractAuthAdapter {
   constructor(params: AuthParameters = {}) {
      super(params)
   }

   async register(user: User, clearPassword?: string): Promise<any> {
      // Mock implementation connecting to PocketBase API
      const pbUrl = this.getParam('pbUrl') || 'http://127.0.0.1:8090'
      console.log(`[PocketBase] Registering user ${user.login} at ${pbUrl}`)
      return { success: true, provider: 'pocketbase' }
   }

   async signup(login: string, password: string): Promise<any> {
      const pbUrl = this.getParam('pbUrl') || 'http://127.0.0.1:8090'
      console.log(`[PocketBase] Signing up user ${login} at ${pbUrl}`)
      return { success: true, provider: 'pocketbase' }
   }

   async signout(user: User): Promise<any> {
      console.log(`[PocketBase] Signing out user ${user.login}`)
      return { success: true }
   }

   async update(user: User, updatable: any): Promise<any> {
      console.log(`[PocketBase] Updating user ${user.login}`)
      return { success: true }
   }

   async delete(user: User): Promise<any> {
      console.log(`[PocketBase] Deleting user ${user.login}`)
      return { success: true }
   }

   getAuthToken(token: string): any {
      return `pocketbase_token_${token}`
   }

   async refreshToken(refreshToken: string): Promise<any> {
      return { token: 'new_pocketbase_token' }
   }

   revokeAuthToken(token: string): any {
      console.log(`[PocketBase] Revoking token ${token}`)
      return { success: true }
   }

   setCustomUserClaims(id: string, claims: any): any {
      console.log(`[PocketBase] Setting custom claims for user ${id}`)
      return { success: true }
   }
}
