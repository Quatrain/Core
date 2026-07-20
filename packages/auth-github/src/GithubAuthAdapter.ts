import { AbstractOAuthAdapter } from '@quatrain/auth'
import { GithubAuthApi } from './GithubAuthApi'
import * as nativeFetch from 'node-fetch-native'

/**
 * Authentication adapter for GitHub OAuth 2.0 Web Application Flow.
 * Handles profiles, repository existence checks, and repository creation.
 */
export class GithubAuthAdapter extends AbstractOAuthAdapter {
   protected _authorizationEndpoint = 'https://github.com/login/oauth/authorize'
   protected _tokenEndpoint = 'https://github.com/login/oauth/access_token'
   protected _userProfileEndpoint = 'https://api.github.com/user'

   /**
    * Factory method to create a new instance from config credentials.
    */
   static factory(config: any): GithubAuthAdapter | null {
      if (!config.clientId || !config.clientSecret) return null
      return new GithubAuthAdapter({ config })
   }

   /**
    * Returns the pluggable API routes builder.
    */
   public override getEndpointHandler(): any {
      return GithubAuthApi
   }

   /**
    * Returns user details from GitHub by validating the access token.
    */
   async getAuthToken(accessToken: string): Promise<any> {
      const response = await nativeFetch.fetch(this._userProfileEndpoint, {
         headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'User-Agent': 'Quatrain-Auth-Github'
         }
      })

      if (!response.ok) {
         throw new Error(`Failed to fetch Github user profile: ${response.statusText}`)
      }

      return await response.json()
   }

   /**
    * Custom GitHub API call to check repository existence.
    */
   async checkRepositoryExists(accessToken: string, owner: string, name: string): Promise<boolean> {
      const response = await nativeFetch.fetch(`https://api.github.com/repos/${owner}/${name}`, {
         headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'User-Agent': 'Quatrain-Auth-Github'
         }
      })
      return response.status === 200
   }

   /**
    * Custom GitHub API call to create a repository.
    */
   async createRepository(accessToken: string, name: string, options: { private?: boolean; description?: string; autoInit?: boolean } = {}): Promise<any> {
      const response = await nativeFetch.fetch('https://api.github.com/user/repos', {
         method: 'POST',
         headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Quatrain-Auth-Github'
         },
         body: JSON.stringify({
            name,
            private: options.private !== false,
            description: options.description || 'Dépôt créé automatiquement par Modaka',
            auto_init: options.autoInit !== false
         })
      })

      if (!response.ok) {
         const errData = await response.json().catch(() => ({}))
         throw new Error(`Failed to create repository: ${errData.message || response.statusText}`)
      }

      return await response.json()
   }
}
