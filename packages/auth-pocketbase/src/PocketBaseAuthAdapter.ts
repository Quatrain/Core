import { Auth, AbstractAuthAdapter, AuthParameters, AuthenticationError } from '@quatrain/auth'
import { User } from '@quatrain/backend'
import PocketBase from 'pocketbase'
import 'cross-fetch/polyfill'

/**
 * Authentication adapter implementing the PocketBase backend logic.
 * Exposes login, registration, and token management via the official `pocketbase` JS SDK.
 */
export class PocketBaseAuthAdapter extends AbstractAuthAdapter {
   protected _client: PocketBase

   constructor(params: AuthParameters = {}) {
      super(params)
      const url = params.config?.url || 'http://127.0.0.1:8090'
      this._client = new PocketBase(url)
      Auth.info(`Created PocketBase client for ${url}`)
   }

   /**
    * Registers a new user directly in PocketBase.
    * 
    * @param user - Target user entity.
    * @param clearPassword - The plaintext password string.
    * @returns The created user record.
    * @throws {AuthenticationError} If registration fails.
    */
   async register(user: User, clearPassword?: string): Promise<any> {
      try {
         const {
            name: displayName,
            email,
            login,
            password,
         } = user._

         const userEmail = email || login
         Auth.info(`[PocketBase] Registering user '${userEmail}'`)
         const record = await this._client.collection('users').create({
            email: userEmail,
            username: login || userEmail?.split('@')[0],
            password: clearPassword || password,
            passwordConfirm: clearPassword || password,
            name: displayName
         })

         return record
      } catch (err: any) {
         Auth.error(err)
         throw new AuthenticationError(err.message || 'Error registering user')
      }
   }

   /**
    * Authenticates a user against PocketBase via email and password.
    * 
    * @param login - Login identifier.
    * @param password - Plaintext password.
    * @returns The authenticated session wrapper containing user state and the JWT token.
    */
   async signup(login: string, password: string): Promise<any> {
      try {
         const authData = await this._client.collection('users').authWithPassword(login, password)
         return { user: authData.record, session: this._client.authStore.token }
      } catch (err: any) {
         Auth.error(err)
         return false
      }
   }

   /**
    * Discards the active local SDK authentication store.
    * 
    * @param user - Target user.
    */
   async signout(user?: User): Promise<any> {
      this._client.authStore.clear()
      return true
   }

   /**
    * Modifies a PocketBase user collection record.
    * 
    * @param user - Target user.
    * @param updatable - Property patches.
    */
   async update(user: User, updatable: any): Promise<any> {
      try {
         if (Object.keys(updatable).length > 0) {
            Auth.info(`[PocketBase] Updating user ${user.uid}`)
            await this._client.collection('users').update(user.uid, updatable)
         }
      } catch (e: any) {
         Auth.error(e)
         if (e.message?.toLowerCase().includes('password')) {
            throw new AuthenticationError(Auth.ERROR_WEAK_PASSWORD)
         }
         throw new AuthenticationError(e.message || 'Error updating user')
      }
   }

   /**
    * Destroys a PocketBase user record.
    * 
    * @param user - Target user.
    */
   async delete(user: User): Promise<any> {
      try {
         await this._client.collection('users').delete(user.uid)
         return true
      } catch (e: any) {
         Auth.error(e)
         return false
      }
   }

   /**
    * Validates and returns user session context from a raw JWT via the PocketBase SDK.
    * 
    * @param token - The raw authentication token.
    * @returns The associated user record.
    */
   async getAuthToken(token: string): Promise<any> {
      try {
         this._client.authStore.save(token, null)
         const authData = await this._client.collection('users').authRefresh()
         return authData.record
      } catch (e) {
         throw new Error('Unable to retrieve auth token from PocketBase')
      }
   }

   /**
    * Attempts to renew the SDK auth token via a refresh flow.
    * 
    * @param refreshToken - The refresh token.
    * @returns An object containing the new access token.
    */
   async refreshToken(refreshToken: string): Promise<any> {
      try {
         this._client.authStore.save(refreshToken, null)
         const authData = await this._client.collection('users').authRefresh()
         return { token: this._client.authStore.token }
      } catch (e) {
         throw new Error('Unable to refresh token from PocketBase')
      }
   }

   /**
    * Clears the current stored context mapping to the given token.
    * 
    * @param token - The token to revoke.
    */
   async revokeAuthToken(token: string): Promise<any> {
      this.signout()
      return true
   }

   /**
    * Modifies metadata claims mapped to the internal `user_metadata` field.
    * 
    * @param id - The user ID.
    * @param claims - The payload to store.
    */
   async setCustomUserClaims(id: string, claims: any): Promise<any> {
      Auth.debug(`[PocketBase] Setting custom claims for user ${id}`)
      try {
         return await this._client.collection('users').update(id, { user_metadata: claims })
      } catch (e) {
         throw new AuthenticationError((e as Error).message)
      }
   }
}
