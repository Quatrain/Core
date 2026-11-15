import { createHash, randomBytes } from 'node:crypto'
import { AbstractOAuthAdapter, AuthParameters } from '@quatrain/auth'
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet, type JWTPayload } from 'jose'

/**
 * Configuration of an OpenID Connect relying party.
 */
export interface OidcClientConfig {
   /** Issuer identifier of the provider, e.g. `https://auth.example.org`. */
   issuer: string
   /** Client identifier registered at the provider. */
   clientId: string
   /** Client secret; omit for a public client (PKCE only). */
   clientSecret?: string
   /** Scopes requested by default (`openid` is always added). */
   scopes?: string[]
   /** Accepted clock difference with the provider, in seconds (default 60). */
   clockToleranceSeconds?: number
   /** Lifetime of the cached discovery document and key set, in milliseconds (default 1 hour). */
   metadataTtlMs?: number
}

/**
 * Subset of the provider metadata (OpenID Connect Discovery 1.0) used by the adapter.
 */
export interface OidcProviderMetadata {
   issuer: string
   authorization_endpoint: string
   token_endpoint: string
   jwks_uri: string
   userinfo_endpoint?: string
   end_session_endpoint?: string
}

/**
 * An authorization request ready to redirect the user agent to.
 * `state`, `nonce` and `codeVerifier` must be kept by the caller (e.g. in a
 * short-lived HTTP-only cookie) and handed back to {@link OidcClientAdapter.completeAuthorization}.
 */
export interface OidcAuthorizationRequest {
   /** URL of the provider authorization endpoint, with every parameter set. */
   url: string
   /** Opaque value echoed back by the provider; compare it on return (CSRF protection). */
   state: string
   /** Value bound to the ID token; checked when the token is verified (replay protection). */
   nonce: string
   /** PKCE code verifier matching the challenge sent in the URL. */
   codeVerifier: string
}

/**
 * Token endpoint response (OpenID Connect Core 1.0, section 3.1.3.3).
 */
export interface OidcTokenSet {
   access_token: string
   token_type: string
   id_token?: string
   refresh_token?: string
   expires_in?: number
   scope?: string
}

/**
 * Outcome of a completed authorization: the tokens and the verified ID token claims.
 */
export interface OidcSession {
   tokens: OidcTokenSet
   claims: JWTPayload
}

/**
 * Error raised by the OpenID Connect client. Its message never contains a secret or a token.
 */
export class OidcClientError extends Error {}

/** Signature algorithms accepted for ID tokens (asymmetric only). */
const ID_TOKEN_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512', 'EdDSA']

/**
 * OpenID Connect relying-party adapter.
 *
 * Implements the authorization code flow with PKCE against any standard provider:
 * endpoints are read from the discovery document, ID tokens are verified against
 * the provider key set (signature, issuer, audience, expiry and nonce).
 *
 * Roles and permissions are not derived here: map the verified claims in the application.
 */
export class OidcClientAdapter extends AbstractOAuthAdapter {
   protected _authorizationEndpoint = ''
   protected _tokenEndpoint = ''
   protected _userProfileEndpoint = ''

   protected _metadata?: OidcProviderMetadata
   protected _metadataLoadedAt = 0
   protected _jwks?: JSONWebKeySet
   protected _jwksLoadedAt = 0

   constructor(params: AuthParameters = {}) {
      super(params)
      const config = this.config
      if (!config.issuer || !config.clientId) {
         throw new OidcClientError('[OidcClientAdapter] "issuer" and "clientId" are required.')
      }
      let issuer: URL
      try {
         issuer = new URL(config.issuer)
      } catch {
         throw new OidcClientError('[OidcClientAdapter] "issuer" must be an absolute URL.')
      }
      const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(issuer.hostname)
      if (issuer.protocol !== 'https:' && !isLoopback) {
         throw new OidcClientError('[OidcClientAdapter] "issuer" must use https (http is accepted for loopback hosts only).')
      }
   }

   /**
    * Factory method creating an instance from a configuration object.
    *
    * @param config - Relying-party configuration.
    * @returns The adapter, or `null` when the issuer or client identifier is missing.
    */
   static factory(config: Partial<OidcClientConfig>): OidcClientAdapter | null {
      if (!config.issuer || !config.clientId) return null
      return new OidcClientAdapter({ config })
   }

   /**
    * Typed access to the relying-party configuration.
    */
   protected get config(): OidcClientConfig {
      return (this._params.config || {}) as OidcClientConfig
   }

   /**
    * Loads the provider discovery document (cached).
    *
    * @param force - Bypass the cache.
    * @returns The provider metadata.
    */
   public async discover(force = false): Promise<OidcProviderMetadata> {
      const ttl = this.config.metadataTtlMs ?? 3_600_000
      if (!force && this._metadata && Date.now() - this._metadataLoadedAt < ttl) {
         return this._metadata
      }

      const issuer = this.config.issuer.replace(/\/+$/, '')
      const metadata = (await this.fetchJson(`${issuer}/.well-known/openid-configuration`, 'discovery document')) as Partial<OidcProviderMetadata>

      if (typeof metadata.issuer !== 'string' || metadata.issuer.replace(/\/+$/, '') !== issuer) {
         throw new OidcClientError('[OidcClientAdapter] Discovery document issuer does not match the configured issuer.')
      }
      for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri'] as const) {
         if (typeof metadata[key] !== 'string' || !metadata[key]) {
            throw new OidcClientError(`[OidcClientAdapter] Discovery document is missing "${key}".`)
         }
      }

      this._metadata = metadata as OidcProviderMetadata
      this._metadataLoadedAt = Date.now()
      this._authorizationEndpoint = this._metadata.authorization_endpoint
      this._tokenEndpoint = this._metadata.token_endpoint
      this._userProfileEndpoint = this._metadata.userinfo_endpoint || ''
      return this._metadata
   }

   /**
    * Builds an authorization request with a fresh state, nonce and PKCE challenge (S256).
    *
    * @param redirectUri - Callback URL registered at the provider.
    * @param options - Extra scopes and additional authorization parameters (e.g. `prompt`, `login_hint`).
    * @returns The redirect URL and the values to keep until the callback.
    */
   public async createAuthorizationRequest(
      redirectUri: string,
      options: { scopes?: string[]; extraParams?: Record<string, string> } = {}
   ): Promise<OidcAuthorizationRequest> {
      const metadata = await this.discover()
      const state = randomToken()
      const nonce = randomToken()
      const codeVerifier = randomToken(48)
      const scopes = Array.from(new Set(['openid', ...(this.config.scopes || []), ...(options.scopes || [])]))

      const url = new URL(metadata.authorization_endpoint)
      for (const [key, value] of Object.entries(options.extraParams || {})) {
         url.searchParams.set(key, value)
      }
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('client_id', this.config.clientId)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('scope', scopes.join(' '))
      url.searchParams.set('state', state)
      url.searchParams.set('nonce', nonce)
      url.searchParams.set('code_challenge', createHash('sha256').update(codeVerifier).digest('base64url'))
      url.searchParams.set('code_challenge_method', 'S256')

      return { url: url.toString(), state, nonce, codeVerifier }
   }

   /**
    * Completes the authorization code flow: exchanges the code and verifies the ID token.
    *
    * @param params - Callback parameters and the values kept from the authorization request.
    * @returns The tokens and the verified ID token claims.
    */
   public async completeAuthorization(params: {
      code: string
      redirectUri: string
      codeVerifier: string
      nonce: string
      state: string
      returnedState: string
   }): Promise<OidcSession> {
      if (!params.state || params.state !== params.returnedState) {
         throw new OidcClientError('[OidcClientAdapter] State mismatch: the callback does not belong to this authorization request.')
      }
      const tokens = await this.requestTokens({
         grant_type: 'authorization_code',
         code: params.code,
         redirect_uri: params.redirectUri,
         code_verifier: params.codeVerifier,
      })
      if (!tokens.id_token) {
         throw new OidcClientError('[OidcClientAdapter] The provider returned no ID token.')
      }
      const claims = await this.verifyIdToken(tokens.id_token, params.nonce)
      return { tokens, claims }
   }

   /**
    * Verifies an ID token: signature against the provider keys, issuer, audience,
    * expiry and, when given, nonce.
    *
    * @param idToken - Compact-serialized ID token.
    * @param nonce - Nonce of the authorization request; omit only for tokens obtained by refresh.
    * @returns The verified claims.
    */
   public async verifyIdToken(idToken: string, nonce?: string): Promise<JWTPayload> {
      const metadata = await this.discover()
      const verify = async (jwks: JSONWebKeySet): Promise<JWTPayload> => {
         const { payload } = await jwtVerify(idToken, createLocalJWKSet(jwks), {
            issuer: metadata.issuer,
            audience: this.config.clientId,
            algorithms: ID_TOKEN_ALGORITHMS,
            clockTolerance: this.config.clockToleranceSeconds ?? 60,
         })
         return payload
      }

      let claims: JWTPayload
      try {
         claims = await verify(await this.loadJwks())
      } catch (error: any) {
         // The provider may have rotated its keys since the key set was cached: reload once.
         if (error?.code !== 'ERR_JWKS_NO_MATCHING_KEY') {
            throw new OidcClientError(`[OidcClientAdapter] ID token rejected: ${error?.code || 'verification failed'}.`)
         }
         try {
            claims = await verify(await this.loadJwks(true))
         } catch (retryError: any) {
            throw new OidcClientError(`[OidcClientAdapter] ID token rejected: ${retryError?.code || 'verification failed'}.`)
         }
      }

      if (nonce !== undefined && claims.nonce !== nonce) {
         throw new OidcClientError('[OidcClientAdapter] ID token rejected: nonce mismatch.')
      }
      if (typeof claims.sub !== 'string' || !claims.sub) {
         throw new OidcClientError('[OidcClientAdapter] ID token rejected: missing subject.')
      }
      return claims
   }

   /**
    * Exchanges an authorization code for tokens, without verifying the ID token.
    * Prefer {@link OidcClientAdapter.completeAuthorization}, which also checks state, PKCE and nonce.
    *
    * @param code - Authorization code.
    * @param redirectUri - Callback URL used in the authorization request.
    * @returns The token endpoint response.
    */
   public override async exchangeCodeForToken(code: string, redirectUri?: string): Promise<OidcTokenSet> {
      return this.requestTokens({
         grant_type: 'authorization_code',
         code,
         ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      })
   }

   /**
    * Obtains new tokens from a refresh token.
    *
    * @param refreshToken - Refresh token issued by the provider.
    * @returns The token endpoint response.
    */
   override async refreshToken(refreshToken: string): Promise<OidcTokenSet> {
      return this.requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken })
   }

   /**
    * Fetches the user claims from the provider UserInfo endpoint.
    *
    * @param accessToken - Access token issued by the provider.
    * @returns The UserInfo claims.
    */
   async getAuthToken(accessToken: string): Promise<Record<string, unknown>> {
      const metadata = await this.discover()
      if (!metadata.userinfo_endpoint) {
         throw new OidcClientError('[OidcClientAdapter] The provider exposes no UserInfo endpoint.')
      }
      const response = await fetch(metadata.userinfo_endpoint, {
         headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      })
      if (!response.ok) {
         throw new OidcClientError(`[OidcClientAdapter] UserInfo request failed (HTTP ${response.status}).`)
      }
      return (await response.json()) as Record<string, unknown>
   }

   /**
    * Builds the provider logout URL (RP-initiated logout), when the provider supports it.
    *
    * @param options - ID token hint and post-logout redirect URL.
    * @returns The logout URL, or `null` when the provider exposes no end-session endpoint.
    */
   public async getEndSessionUrl(options: { idTokenHint?: string; postLogoutRedirectUri?: string } = {}): Promise<string | null> {
      const metadata = await this.discover()
      if (!metadata.end_session_endpoint) return null
      const url = new URL(metadata.end_session_endpoint)
      url.searchParams.set('client_id', this.config.clientId)
      if (options.idTokenHint) url.searchParams.set('id_token_hint', options.idTokenHint)
      if (options.postLogoutRedirectUri) url.searchParams.set('post_logout_redirect_uri', options.postLogoutRedirectUri)
      return url.toString()
   }

   /**
    * The discovery document is asynchronous: use {@link OidcClientAdapter.createAuthorizationRequest}.
    */
   public override getAuthorizationUrl(): string {
      throw new OidcClientError('[OidcClientAdapter] Use createAuthorizationRequest(): it adds the state, nonce and PKCE challenge.')
   }

   /**
    * Calls the token endpoint with a form-encoded body.
    * A confidential client authenticates with HTTP Basic; a public client sends its identifier.
    */
   protected async requestTokens(parameters: Record<string, string>): Promise<OidcTokenSet> {
      const metadata = await this.discover()
      const body = new URLSearchParams(parameters)
      const headers: Record<string, string> = {
         'Content-Type': 'application/x-www-form-urlencoded',
         Accept: 'application/json',
      }
      if (this.config.clientSecret) {
         const credentials = `${encodeURIComponent(this.config.clientId)}:${encodeURIComponent(this.config.clientSecret)}`
         headers.Authorization = `Basic ${Buffer.from(credentials).toString('base64')}`
      } else {
         body.set('client_id', this.config.clientId)
      }

      const response = await fetch(metadata.token_endpoint, { method: 'POST', headers, body: body.toString() })
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (!response.ok || data.error) {
         const reason = typeof data.error === 'string' ? data.error : `HTTP ${response.status}`
         throw new OidcClientError(`[OidcClientAdapter] Token request failed: ${reason}.`)
      }
      if (typeof data.access_token !== 'string') {
         throw new OidcClientError('[OidcClientAdapter] Token response contains no access token.')
      }
      return data as unknown as OidcTokenSet
   }

   /**
    * Loads the provider key set (cached).
    */
   protected async loadJwks(force = false): Promise<JSONWebKeySet> {
      const ttl = this.config.metadataTtlMs ?? 3_600_000
      if (!force && this._jwks && Date.now() - this._jwksLoadedAt < ttl) {
         return this._jwks
      }
      const metadata = await this.discover()
      const jwks = (await this.fetchJson(metadata.jwks_uri, 'key set')) as JSONWebKeySet
      if (!Array.isArray(jwks.keys)) {
         throw new OidcClientError('[OidcClientAdapter] The provider key set is malformed.')
      }
      this._jwks = jwks
      this._jwksLoadedAt = Date.now()
      return jwks
   }

   /**
    * Fetches a JSON document from the provider.
    */
   protected async fetchJson(url: string, label: string): Promise<unknown> {
      let response: Response
      try {
         response = await fetch(url, { headers: { Accept: 'application/json' } })
      } catch {
         throw new OidcClientError(`[OidcClientAdapter] The provider ${label} cannot be reached.`)
      }
      if (!response.ok) {
         throw new OidcClientError(`[OidcClientAdapter] The provider ${label} request failed (HTTP ${response.status}).`)
      }
      return response.json()
   }
}

/**
 * Generates a URL-safe random token.
 *
 * @param bytes - Number of random bytes (default 32).
 */
function randomToken(bytes = 32): string {
   return randomBytes(bytes).toString('base64url')
}
