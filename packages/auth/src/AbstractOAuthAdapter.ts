import { AbstractAuthAdapter } from './AbstractAuthAdapter'
import { AuthParameters } from './Auth'
import { User } from '@quatrain/backend'
import * as nativeFetch from 'node-fetch-native'

/**
 * Abstract class summarizing typical OAuth2 Web Application Flows.
 * Extend this to implement providers like GitHub, GitLab, Google, etc.
 */
export abstract class AbstractOAuthAdapter extends AbstractAuthAdapter {
   protected abstract _authorizationEndpoint: string
   protected abstract _tokenEndpoint: string
   protected abstract _userProfileEndpoint: string

   constructor(params: AuthParameters = {}) {
      super(params)
   }

   /**
    * Returns the authorization redirect URL.
    * 
    * @param redirectUri - The callback URL.
    * @param scopes - The requested authorization scopes.
    * @param state - The state parameters for CSRF protection.
    * @returns The generated authorization URL.
    */
   public getAuthorizationUrl(redirectUri?: string, scopes: string[] = [], state?: string): string {
      const clientId = this._params.config?.clientId
      if (!clientId) {
         throw new Error(`[${this.constructor.name}] Client ID is not configured.`)
      }

      let url = `${this._authorizationEndpoint}?client_id=${clientId}`
      if (scopes.length > 0) {
         url += `&scope=${encodeURIComponent(scopes.join(' '))}`
      }
      if (redirectUri) {
         url += `&redirect_uri=${encodeURIComponent(redirectUri)}`
      }
      if (state) {
         url += `&state=${encodeURIComponent(state)}`
      }
      return url
   }

   /**
    * Exchanges the temporary authorization code for an access token packet.
    * 
    * @param code - The temporary auth code.
    * @param redirectUri - Optional redirect URL context.
    * @returns Access token payload.
    */
   public async exchangeCodeForToken(code: string, redirectUri?: string): Promise<any> {
      const clientId = this._params.config?.clientId
      const clientSecret = this._params.config?.clientSecret

      if (!clientId || !clientSecret) {
         throw new Error(`[${this.constructor.name}] Client ID or Client Secret is not configured.`)
      }

      const body: Record<string, string> = {
         client_id: clientId,
         client_secret: clientSecret,
         code,
         grant_type: 'authorization_code'
      }

      if (redirectUri) {
         body.redirect_uri = redirectUri
      }

      const response = await nativeFetch.fetch(this._tokenEndpoint, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
         },
         body: JSON.stringify(body)
      })

      if (!response.ok) {
         throw new Error(`[${this.constructor.name}] OAuth token exchange failed: ${response.statusText}`)
      }

      const data = await response.json()
      if (data.error) {
         throw new Error(`[${this.constructor.name}] OAuth error: ${data.error_description || data.error}`)
      }

      return data // Access token, scopes, token_type, etc.
   }

   // Implement standard AuthInterface stubs
   async register(user: User, clearPassword?: string): Promise<any> {
      throw new Error(`register is not supported by ${this.constructor.name}`)
   }

   async signup(login: string, password: string): Promise<any> {
      throw new Error(`signup is not supported by ${this.constructor.name}. Use exchangeCodeForToken instead.`)
   }

   async signout(user: User): Promise<any> {
      return true
   }

   async update(user: User, updatable: any): Promise<any> {
      return true
   }

   async delete(user: User): Promise<any> {
      return true
   }

   async refreshToken(refreshToken: string): Promise<any> {
      throw new Error(`refreshToken is not implemented for ${this.constructor.name}`)
   }

   /**
    * Revokes the access token (noop default).
    * 
    * @param token - Target token to revoke.
    */
   async revokeAuthToken(token: string): Promise<any> {
      return true
   }

   /**
    * Inject custom claims (not supported by default).
    * 
    * @param id - Target user ID.
    * @param claims - Payload claims.
    */
   async setCustomUserClaims(id: string, claims: any): Promise<any> {
      throw new Error(`setCustomUserClaims is not supported by ${this.constructor.name}`)
   }

   abstract getAuthToken(token: string): any
}
