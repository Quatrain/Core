import { AuthProvider } from './AuthProvider'

/**
 * Generic OAuth Provider bridge.
 * Expects an asynchronous callback that returns an active Access Token.
 * It is up to the developer to provide a callback that handles token refreshing
 * (e.g. using oidc-client-ts or a custom fetch).
 */
export class OAuthProvider implements AuthProvider {
   private tokenFetcher: () => Promise<string>

   constructor(tokenFetcher: () => Promise<string>) {
      this.tokenFetcher = tokenFetcher
   }

   public async getHeaders(): Promise<Record<string, string>> {
      const token = await this.tokenFetcher()
      return {
         Authorization: `Bearer ${token}`,
      }
   }
}
