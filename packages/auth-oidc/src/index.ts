import Provider from 'oidc-provider'

export class AuthOIDC {
   public static init(issuer: string, config?: any) {
      // Basic minimal configuration for PoC
      const configuration = {
         clients: [{
            client_id: 'studio-client',
            client_secret: 'secret',
            redirect_uris: ['http://localhost:3000/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code']
         }],
         // Default features (PKCE etc.)
         features: {
            devInteractions: { enabled: true } // Provides a basic dev login screen automatically
         },
         ...config
      }

      const oidc = new Provider(issuer, configuration)
      return oidc
   }
}
