import { Auth, AuthParameters, AuthParametersKeys } from './Auth'
import { User } from '@quatrain/backend'
import { AuthInterface } from './types/AuthInterface'
import { ApiMiddleware, ApiRequest, ApiResponse } from '@quatrain/api'

/**
 * Abstract base class that defines the contract for all authentication adapters.
 * Implementations should adapt standard authentication methods to specific providers
 * (e.g. Firebase, Supabase, basic auth).
 */
export abstract class AbstractAuthAdapter implements AuthInterface {
   /** The `User` class reference to be used by the adapter. */
   static UserClass = User
   protected _alias: string = ''
   protected _params: AuthParameters = {}

   constructor(params: AuthParameters = {}) {
      this._params = params
   }

   /**
    * Express middleware capturing Bearer JWT tokens to execute auth verification.
    * 
    * @returns The middleware function.
    */
   public middleware(): ApiMiddleware {
      return async (req: ApiRequest, res: ApiResponse): Promise<boolean> => {
         const bearer = ((req.headers?.authorization as string) || '').split(' ')[1] || ''
         
         if (bearer) {
            try {
               const user = await this.getAuthToken(bearer)
               if (user) {
                  return true // Authorized
               }
            } catch(e) {
               Auth.error(`[${this.constructor.name}] Middleware token verification failed: ${(e as Error).message}`)
            }
         }

         res.setHeader('WWW-Authenticate', 'Bearer realm="Core API"')
         res.status(401).send('Authentication required.')
         return false
      }
   }

   /**
    * Assigns a configuration parameter for the adapter.
    * 
    * @param key - The parameter key.
    * @param value - The parameter value.
    */
   setParam(key: AuthParametersKeys, value: any) {
      this._params[key] = value
   }

   /**
    * Retrieves a configuration parameter.
    * 
    * @param key - The parameter key to fetch.
    * @returns The corresponding configuration value.
    */
   getParam(key: AuthParametersKeys) {
      return this._params[key]
   }

   set alias(alias: string) {
      this._alias = alias
   }

   get alias() {
      return this._alias
   }

   /**
    * Registers a new user directly in the authentication provider.
    * 
    * @param user - The User object.
    * @param clearPassword - The plaintext password.
    * @returns A promise resolving to the registration response.
    */
   abstract register(user: User, clearPassword?: string): Promise<any>

   /**
    * Authenticates a user by login and password (generates tokens).
    * 
    * @param login - User's email or login name.
    * @param password - Plaintext password.
    * @returns A promise resolving to the token payload.
    */
   abstract signup(login: string, password: string): Promise<any>

   /**
    * Terminates the current authentication session.
    * 
    * @param user - The User footprint.
    * @returns A promise resolving to the provider's signout response.
    */
   abstract signout(user: User): Promise<any>

   /**
    * Updates user credentials or metadata within the external auth provider.
    * 
    * @param user - The User to modify.
    * @param updatable - The delta payload of properties to update.
    * @returns A promise resolving when the update completes.
    */
   abstract update(user: User, updatable: any): Promise<any>

   /**
    * Hard-deletes a user from the authentication provider.
    * 
    * @param user - The User to delete.
    * @returns A promise resolving on successful deletion.
    */
   abstract delete(user: User): Promise<any>

   /**
    * Validates and decodes an incoming authentication token.
    * 
    * @param token - The raw token string (e.g. JWT).
    * @returns The decoded token data payload.
    */
   abstract getAuthToken(token: string): any

   /**
    * Refreshes an expired access token using a valid refresh token.
    * 
    * @param refreshToken - The refresh token string.
    * @returns A promise resolving to the new access token payload.
    */
   abstract refreshToken(refreshToken: string): Promise<any>

   /**
    * Invalidates a specific access token explicitly.
    * 
    * @param token - The token string to revoke.
    * @returns Action response from the provider.
    */
   abstract revokeAuthToken(token: string): any

   /**
    * Injects custom claims (e.g. role, tenant info) into the user's token structure.
    * 
    * @param id - The user ID.
    * @param claims - The payload of claims to merge.
    * @returns Action response from the provider.
    */
   abstract setCustomUserClaims(id: string, claims: any): any

   /**
    * Initiates password recovery/reset process for a user.
    * 
    * @param email - The user email.
    * @param redirectTo - Optional redirect destination.
    */
   recoverPassword(email: string, redirectTo?: string): Promise<any> {
      throw new Error('Password recovery not implemented for this adapter')
   }
}
