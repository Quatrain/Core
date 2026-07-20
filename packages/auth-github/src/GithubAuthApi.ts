import { ServerAdapter, ApiRequest, ApiResponse } from '@quatrain/api'
import { GithubAuthAdapter } from './GithubAuthAdapter'

/**
 * Pluggable router endpoints for Github OAuth authentication.
 * Compatible with any Quatrain ServerAdapter (Astro, Express, etc.).
 */
export function GithubAuthApi(router: ServerAdapter, path: string, options: any = {}) {
   const adapter = options.adapter || GithubAuthAdapter.factory(options.config || {})
   if (!adapter) {
      throw new Error('GithubAuthApi requires a valid GithubAuthAdapter or configuration.')
   }

   // Route: GET [root]/login
   router.get('/login', async (req: ApiRequest, res: ApiResponse) => {
      const redirectUri = req.query.redirect_uri as string
      const scopes = (req.query.scopes as string || 'repo').split(',')
      const state = req.query.state as string
      
      const authUrl = adapter.getAuthorizationUrl(redirectUri, scopes, state)
      res.status(302).setHeader('Location', authUrl)
      res.send(`Redirecting to GitHub...`)
   })

   // Route: GET [root]/callback
   router.get('/callback', async (req: ApiRequest, res: ApiResponse) => {
      const code = req.query.code as string
      const redirectUri = req.query.redirect_uri as string
      const platform = req.query.platform as string
      
      if (!code) {
         res.status(400).send('Missing authorization code.')
         return
      }

      try {
         const tokenData = await adapter.exchangeCodeForToken(code, redirectUri)
         
         // Support standard deep link redirect for mobile context if a URI is provided
         const mobileRedirectUri = req.query.mobile_redirect_uri as string || options.mobileRedirectUri
         if (mobileRedirectUri) {
            const redirectUrl = `${mobileRedirectUri}?token=${tokenData.access_token}`
            res.status(302).setHeader('Location', redirectUrl)
            res.send(`Redirecting back to app...`)
            return
         }

         res.status(200).json(tokenData)
      } catch (err: any) {
         res.status(500).send(`OAuth error: ${err.message}`)
      }
   })
}
