import { User } from '@quatrain/backend'
import {
   Auth,
   AbstractAuthAdapter,
   AuthenticationError,
   AuthParameters,
} from '@quatrain/auth'

import { CreateRequest, UpdateRequest, getAuth } from 'firebase-admin/auth'
import { getApps, initializeApp } from 'firebase-admin/app'
import * as nativeFetch from 'node-fetch-native'

/**
 * Authentication adapter implementing the Google Firebase Auth ecosystem.
 * Handles server-side validation of JWTs and admin functions via `firebase-admin`.
 */
export class FirebaseAuthAdapter extends AbstractAuthAdapter {
   /**
    * Bootstraps the adapter using Firebase credentials.
    * 
    * @param config - Firebase admin SDK configuration block.
    * @returns The adapter instance.
    */
   static factory(config: any): FirebaseAuthAdapter {
      return new FirebaseAuthAdapter({ config })
   }



   constructor(params: AuthParameters = {}) {
      super(params)
      if (getApps().length === 0 && params.config) {
         initializeApp(params.config)
      }
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
            disabled = false,
         } = user._
         const authData: CreateRequest = {
            uid: user.uid,
            email,
            phoneNumber,
            password: clearPassword || password,
            disabled,
            displayName,
         }
         Auth.log(`[FAA] Adding user '${displayName}'`)
         const userRecord = await getAuth().createUser(authData)

         return userRecord.uid
      } catch (err) {
         throw new AuthenticationError((err as Error).message)
      }
   }

   /**
    * Verifies a Firebase ID token using the admin SDK.
    * 
    * @param bearer - The JWT token string.
    * @returns A promise resolving to the decoded token object.
    */
   async getAuthToken(bearer: string) {
      return await getAuth().verifyIdToken(bearer)
   }

   /**
    * User authentication flow (Not natively supported on Firebase Admin Server SDK).
    * Usually handled on the client.
    * 
    * @param login - Email address.
    * @param password - Plain password.
    */
   async signup(login: string, password: string) {}

   /**
    * Signs out the user (No-op in server-side stateless Firebase admin).
    * 
    * @param user - Target user.
    */
   async signout(user: User): Promise<any> {}

   /**
    * Modifies an existing user's attributes in the Firebase Auth registry.
    * 
    * @param user - Target user.
    * @param updatable - Properties to modify (e.g. displayName, disabled status).
    */
   async update(user: User, updatable: UpdateRequest): Promise<any> {
      Auth.log('auth data to update', JSON.stringify(updatable))

      try {
         if (Object.keys(updatable).length > 0) {
            Auth.log(`Updating ${updatable.displayName} Auth record`)
            await getAuth().updateUser(user.uid, updatable)
         }
      } catch (e) {}
   }

   /**
    * Completely removes a user from the Firebase Auth registry.
    * 
    * @param user - Target user.
    */
   async delete(user: User): Promise<any> {
      return await getAuth().deleteUser(user.uid)
   }

   /**
    * Revokes a specific access token.
    * 
    * @param token - The token string.
    */
   async revokeAuthToken(token: string) {}

   /**
    * Updates the custom JWT claims embedded in a user's Firebase token.
    * 
    * @param id - User UID.
    * @param claims - Claims dictionary.
    */
   async setCustomUserClaims(id: string, claims: any) {}

   /**
    * Requests a new ID token using a refresh token via Google Secure Token API.
    * 
    * @param refreshToken - The active refresh token.
    * @returns The generated token payload.
    */
   async refreshToken(refreshToken: string): Promise<any> {
      if (!this._params.config.apiKey) {
         Auth.warn(`Can't get refresh token, no API key provided`)
         return {}
      }
      const response = await nativeFetch.fetch(
         `https://securetoken.googleapis.com/v1/token?key=${this._params.config.apiKey}`,
         {
            method: 'POST',
            body: JSON.stringify({
               grant_type: 'refresh_token',
               refresh_token: refreshToken,
            }),
            headers: { 'Content-Type': 'application/json' }, //, crossdomain: true },
         }
      )

      const data = response.json()

      return data
   }
}
