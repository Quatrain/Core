import { User } from '@quatrain/backend'
import {
   Auth,
   AbstractAuthAdapter,
   AuthenticationError,
   AuthParameters,
} from '@quatrain/auth'

import { createClient } from '@supabase/supabase-js'
import * as nativeFetch from 'node-fetch-native'

// Create a single supabase client for interacting with your database
/**
 * Authentication adapter implementing the Supabase SDK ecosystem.
 * Acts as a centralized bridge handling signup, tokens, and middleware enforcement.
 */
export class SupabaseAuthAdapter extends AbstractAuthAdapter {
   protected _client: any

   /**
    * Initializes a new instance securely with Supabase configuration keys.
    * 
    * @param config - Must contain `supabaseUrl` and `supabaseKey`.
    * @returns A constructed SupabaseAuthAdapter or null on invalid params.
    */
   static factory(config: any): SupabaseAuthAdapter | null {
      if (!config.supabaseUrl || !config.supabaseKey) return null
      return new SupabaseAuthAdapter({ config })
   }



   constructor(params: AuthParameters = {}) {
      super(params)
      this._client = createClient(
         params.config.supabaseUrl,
         params.config.supabaseKey,
         {
            auth: {
               autoRefreshToken: false,
               persistSession: false,
            },
         }
      )
      Auth.info(`Created Supabase client for ${params.config.supabaseUrl}`)
   }

   /**
    * Register new user in authentication
    * @param user
    * @returns user unique id
    */
   async register(user: User, clearPassword?: string) {
      try {
         const {
            name: displayName,
            email,
            phone: phoneNumber,
            password,
         } = user._

         Auth.info(`[SAA] Adding user '${displayName}'`)
         const { data, error } = await this._client.auth.admin.createUser({
            email,
            password: clearPassword || password,
            email_confirm: true, // TODO move to params
         })

         if (error) {
            Auth.error(error.message)
            if (error.code === 'email_exists') {
               throw new AuthenticationError(Auth.ERROR_EMAIL_EXISTS)
            }
            throw new Error(error)
         }

         return data.user
      } catch (err) {
         Auth.error(err)
         throw new AuthenticationError((err as Error).message)
      }
   }

   /**
    * Resolves a raw Bearer token via the Supabase Auth API (`getUser`).
    * 
    * @param bearer - Raw JWT string.
    * @returns The decoded user object.
    * @throws {Error} If verification fails.
    */
   async getAuthToken(bearer: string) {
      const token = await this._client.auth.getUser(bearer)
      if (token.data && token.data.user) {
         return token.data.user
      }
      throw new Error('Unable to retrieve auth token from Supabase')
   }

   /**
    * Obtains a new JWT access token by exchanging the persistent refresh token.
    * 
    * @param refreshToken - The token.
    * @returns Resolves the token packet.
    */
   async refreshToken(refreshToken: string) {
      const url = `${this._params.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`
      const response = await nativeFetch.fetch(url, {
         method: 'POST',
         headers: {
            apikey: this._params.config.supabaseKey,
         },
         body: JSON.stringify({
            refresh_token: refreshToken,
         }),
      })

      const data = response.json()

      return data
   }

   /**
    * Instructs the Supabase client to destroy the current session.
    * 
    * @param token - Target token.
    */
   async revokeAuthToken(token: string) {
      // Careful, this only delete tokens on client side, not on server side
      const { error } = await this.signout()
      if (error !== null) {
         Auth.error(error)
         return false
      }
   }

   /**
    * Executes a direct login / session instantiation via `signInWithPassword`.
    * 
    * @param login - Email string.
    * @param password - Raw password.
    * @returns Resolved user session.
    */
   async signup(login: string, password: string) {
      const { data, error } = await this._client.auth.signInWithPassword({
         email: login,
         password,
      })

      if (error !== null) {
         Auth.error(error)
         return false
      }

      return { user: data.user, session: data.session }
   }

   /**
    * Disconnects and destroys the active session context.
    * 
    * @returns True if successful.
    */
   async signout(): Promise<any> {
      const { error } = await this._client.auth.signOut()
      if (error !== null) {
         Auth.error(error)
         return false
      }
      return true
   }

   /**
    * Modifies a Supabase Auth user record.
    * 
    * @param user - Target user.
    * @param updatable - The delta properties.
    */
   async update(user: User, updatable: any): Promise<any> {
      Auth.debug('auth data to update', JSON.stringify(updatable))

      try {
         if (Object.keys(updatable).length > 0) {
            Auth.info(`Updating ${updatable.displayName} Auth record`)
            const { error } = await this._client.auth.admin.updateUserById(
               user.uid,
               updatable
            )
            if (error !== null) {
               Auth.error(error)
            }
         }
      } catch (e) {
         Auth.error(e)
         return false
      }
   }

   /**
    * (Unimplemented) Destroys the user context inside Supabase.
    * 
    * @param user - Target user.
    */
   async delete(user: User): Promise<any> {
      // return await getAuth().deleteUser(user.uid)
   }

   /**
    * Merges specific attributes into the Supabase `user_metadata` field using the admin API.
    * 
    * @param id - The target user ID.
    * @param claims - The payload of new claims.
    * @returns Resolved updated user wrapper.
    */
   async setCustomUserClaims(id: string, claims: any) {
      Auth.debug(`Updating user ${id} with claims ${JSON.stringify(claims)}`)
      const { data, error } = await this._client.auth.admin.updateUserById(id, {
         user_metadata: claims,
      })

      if (error) {
         throw new AuthenticationError(error)
      } else {
         return data
      }
   }
}
