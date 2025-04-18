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
export class SupabaseAuthAdapter extends AbstractAuthAdapter {
   protected _client: any

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
   }

   /**
    * Register new user in authentication
    * @param user
    * @returns user unique id
    */
   async register(user: User) {
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
            password,
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

   async getAuthToken(bearer: string) {
      const token = await this._client.auth.getUser(bearer)
      if (token.data && token.data.user) {
         return token.data.user
      }
      throw new Error('Unable to retrieve auth token from Supabase')
   }

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

   async revokeAuthToken(token: string) {
      // Careful, this only delete tokens on client side, not on server side
      const { error } = await this.signout()
   }

   async signup(login: string, password: string) {
      const { data, error } = await this._client.auth.signInWithPassword({
         email: login,
         password,
      })

      if (error !== null) {
         Auth.log(error)
         return false
      }

      return { user: data.user, session: data.session }
   }

   async signout(): Promise<any> {
      const { data, error } = await this._client.auth.signOut()
      if (error !== null) {
         Auth.error(error)
         return false
      }
      return true
   }

   async update(user: User, updatable: any): Promise<any> {
      Auth.debug('auth data to update', JSON.stringify(updatable))

      try {
         if (Object.keys(updatable).length > 0) {
            Auth.info(`Updating ${updatable.displayName} Auth record`)
            const { data, error } =
               await this._client.auth.admin.updateUserById(user.uid, updatable)
            if (error !== null) {
               Auth.log(error)
            }
         }
      } catch (e) {}
   }

   async delete(user: User): Promise<any> {
      // return await getAuth().deleteUser(user.uid)
   }

   async setCustomUserClaims(id: string, claims: any) {
      Auth.debug(`Updating user ${id} with claims ${JSON.stringify(claims)}`)
      const { data, error } = await this._client.auth.admin.updateUserById(id, {
         user_metadata: claims,
      })

      console.log(data, error)
      if (error) {
         throw new AuthenticationError(error)
      } else {
         return data
      }
   }
}
