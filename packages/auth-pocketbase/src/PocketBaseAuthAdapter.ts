import { Auth, AbstractAuthAdapter, AuthParameters, AuthenticationError } from '@quatrain/auth'
import { User } from '@quatrain/backend'
import PocketBase from 'pocketbase'
import 'cross-fetch/polyfill'

export class PocketBaseAuthAdapter extends AbstractAuthAdapter {
   protected _client: PocketBase

   constructor(params: AuthParameters = {}) {
      super(params)
      const url = params.config?.url || 'http://127.0.0.1:8090'
      this._client = new PocketBase(url)
      Auth.info(`Created PocketBase client for ${url}`)
   }

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

   async signup(login: string, password: string): Promise<any> {
      try {
         const authData = await this._client.collection('users').authWithPassword(login, password)
         return { user: authData.record, session: this._client.authStore.token }
      } catch (err: any) {
         Auth.error(err)
         return false
      }
   }

   async signout(user?: User): Promise<any> {
      this._client.authStore.clear()
      return true
   }

   async update(user: User, updatable: any): Promise<any> {
      try {
         if (Object.keys(updatable).length > 0) {
            Auth.info(`[PocketBase] Updating user ${user.uid}`)
            await this._client.collection('users').update(user.uid, updatable)
         }
      } catch (e: any) {
         Auth.error(e)
         return false
      }
   }

   async delete(user: User): Promise<any> {
      try {
         await this._client.collection('users').delete(user.uid)
         return true
      } catch (e: any) {
         Auth.error(e)
         return false
      }
   }

   async getAuthToken(token: string): Promise<any> {
      try {
         this._client.authStore.save(token, null)
         const authData = await this._client.collection('users').authRefresh()
         return authData.record
      } catch (e) {
         throw new Error('Unable to retrieve auth token from PocketBase')
      }
   }

   async refreshToken(refreshToken: string): Promise<any> {
      try {
         this._client.authStore.save(refreshToken, null)
         const authData = await this._client.collection('users').authRefresh()
         return { token: this._client.authStore.token }
      } catch (e) {
         throw new Error('Unable to refresh token from PocketBase')
      }
   }

   async revokeAuthToken(token: string): Promise<any> {
      this.signout()
      return true
   }

   async setCustomUserClaims(id: string, claims: any): Promise<any> {
      Auth.debug(`[PocketBase] Setting custom claims for user ${id}`)
      try {
         return await this._client.collection('users').update(id, { user_metadata: claims })
      } catch (e) {
         throw new AuthenticationError((e as Error).message)
      }
   }
}
