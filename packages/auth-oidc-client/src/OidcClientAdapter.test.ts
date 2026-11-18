import { createHash } from 'node:crypto'
import { SignJWT, exportJWK, generateKeyPair, type JWK, type KeyLike } from 'jose'
import { OidcClientAdapter, OidcClientError } from './OidcClientAdapter'

const ISSUER = 'https://auth.example.org'
const CLIENT_ID = 'acme-app'
const REDIRECT = 'https://app.example.org/callback'

const METADATA = {
   issuer: ISSUER,
   authorization_endpoint: `${ISSUER}/authorize`,
   token_endpoint: `${ISSUER}/token`,
   jwks_uri: `${ISSUER}/jwks`,
   userinfo_endpoint: `${ISSUER}/userinfo`,
   end_session_endpoint: `${ISSUER}/logout`,
}

interface Key {
   privateKey: KeyLike
   jwk: JWK
}

async function newKey(kid: string): Promise<Key> {
   const { privateKey, publicKey } = await generateKeyPair('RS256')
   return { privateKey, jwk: { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' } }
}

function idToken(key: Key, claims: Record<string, unknown> = {}, options: { issuer?: string; audience?: string; expiresIn?: string } = {}): Promise<string> {
   return new SignJWT({ nonce: 'n-1', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: key.jwk.kid })
      .setSubject('user-1')
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '5m')
      .sign(key.privateKey)
}

function json(body: unknown, status = 200): Response {
   return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('OidcClientAdapter', () => {
   let key: Key
   let calls: { url: string; init?: RequestInit }[]
   let routes: Record<string, () => Response>

   beforeAll(async () => {
      key = await newKey('k1')
   })

   beforeEach(() => {
      calls = []
      routes = {
         [`${ISSUER}/.well-known/openid-configuration`]: () => json(METADATA),
         [`${ISSUER}/jwks`]: () => json({ keys: [key.jwk] }),
      }
      global.fetch = jest.fn(async (input: any, init?: RequestInit) => {
         const url = String(input)
         calls.push({ url, init })
         const route = routes[url]
         return route ? route() : json({ error: 'not_found' }, 404)
      }) as any
   })

   const adapter = (config: Record<string, unknown> = {}) => new OidcClientAdapter({ config: { issuer: ISSUER, clientId: CLIENT_ID, ...config } })

   describe('configuration', () => {
      it('requires an issuer and a client identifier', () => {
         expect(OidcClientAdapter.factory({})).toBeNull()
         expect(OidcClientAdapter.factory({ issuer: ISSUER })).toBeNull()
         expect(OidcClientAdapter.factory({ issuer: ISSUER, clientId: CLIENT_ID })).toBeInstanceOf(OidcClientAdapter)
      })

      it('rejects a non-https issuer except on loopback', () => {
         expect(() => adapter({ issuer: 'http://auth.example.org' })).toThrow(OidcClientError)
         expect(() => adapter({ issuer: 'not a url' })).toThrow(OidcClientError)
         expect(() => adapter({ issuer: 'http://localhost:3000' })).not.toThrow()
      })
   })

   describe('discover()', () => {
      it('loads and caches the provider metadata', async () => {
         const client = adapter()
         expect((await client.discover()).token_endpoint).toBe(`${ISSUER}/token`)
         await client.discover()
         expect(calls).toHaveLength(1)
         await client.discover(true)
         expect(calls).toHaveLength(2)
      })

      it('rejects a document issued for another issuer or missing an endpoint', async () => {
         routes[`${ISSUER}/.well-known/openid-configuration`] = () => json({ ...METADATA, issuer: 'https://evil.example.org' })
         await expect(adapter().discover()).rejects.toThrow(/issuer does not match/)
         routes[`${ISSUER}/.well-known/openid-configuration`] = () => json({ ...METADATA, jwks_uri: undefined })
         await expect(adapter().discover()).rejects.toThrow(/missing "jwks_uri"/)
         routes[`${ISSUER}/.well-known/openid-configuration`] = () => json({}, 500)
         await expect(adapter().discover()).rejects.toThrow(/HTTP 500/)
      })
   })

   describe('createAuthorizationRequest()', () => {
      it('builds a code flow URL with state, nonce and an S256 PKCE challenge', async () => {
         const request = await adapter({ scopes: ['profile'] }).createAuthorizationRequest(REDIRECT, { scopes: ['email'], extraParams: { prompt: 'login' } })
         const url = new URL(request.url)
         expect(`${url.origin}${url.pathname}`).toBe(`${ISSUER}/authorize`)
         expect(Object.fromEntries(url.searchParams)).toMatchObject({
            response_type: 'code',
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT,
            scope: 'openid profile email',
            state: request.state,
            nonce: request.nonce,
            code_challenge_method: 'S256',
            prompt: 'login',
         })
         expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(request.codeVerifier).digest('base64url'))
      })

      it('generates fresh values for each request and cannot be overridden by extra parameters', async () => {
         const client = adapter()
         const first = await client.createAuthorizationRequest(REDIRECT)
         const second = await client.createAuthorizationRequest(REDIRECT, { extraParams: { state: 'forced', client_id: 'other' } })
         expect(first.state).not.toBe(second.state)
         expect(first.codeVerifier).not.toBe(second.codeVerifier)
         expect(new URL(second.url).searchParams.get('state')).toBe(second.state)
         expect(new URL(second.url).searchParams.get('client_id')).toBe(CLIENT_ID)
      })

      it('refuses the synchronous OAuth helper', () => {
         expect(() => adapter().getAuthorizationUrl()).toThrow(/createAuthorizationRequest/)
      })
   })

   describe('completeAuthorization()', () => {
      const params = { code: 'c-1', redirectUri: REDIRECT, codeVerifier: 'v-1', nonce: 'n-1', state: 's-1', returnedState: 's-1' }

      it('exchanges the code with PKCE and returns the verified claims (public client)', async () => {
         const token = await idToken(key, { email: 'user@example.org' })
         routes[`${ISSUER}/token`] = () => json({ access_token: 'at', token_type: 'Bearer', id_token: token, refresh_token: 'rt' })

         const session = await adapter().completeAuthorization(params)
         expect(session.claims).toMatchObject({ sub: 'user-1', email: 'user@example.org' })
         expect(session.tokens.refresh_token).toBe('rt')

         const call = calls.find((c) => c.url === `${ISSUER}/token`)
         const body = new URLSearchParams(String(call?.init?.body))
         expect(Object.fromEntries(body)).toEqual({ grant_type: 'authorization_code', code: 'c-1', redirect_uri: REDIRECT, code_verifier: 'v-1', client_id: CLIENT_ID })
         expect((call?.init?.headers as Record<string, string>).Authorization).toBeUndefined()
      })

      it('authenticates a confidential client with HTTP Basic', async () => {
         routes[`${ISSUER}/token`] = () => json({ access_token: 'at', token_type: 'Bearer', id_token: 'x' })
         await adapter({ clientSecret: 's3cr3t' }).exchangeCodeForToken('c-1', REDIRECT)
         const call = calls.find((c) => c.url === `${ISSUER}/token`)
         expect((call?.init?.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from(`${CLIENT_ID}:s3cr3t`).toString('base64')}`)
         expect(new URLSearchParams(String(call?.init?.body)).has('client_id')).toBe(false)
      })

      it('rejects a state mismatch before calling the provider', async () => {
         await expect(adapter().completeAuthorization({ ...params, returnedState: 'other' })).rejects.toThrow(/State mismatch/)
         expect(calls).toHaveLength(0)
      })

      it('reports a token endpoint error without leaking the response', async () => {
         routes[`${ISSUER}/token`] = () => json({ error: 'invalid_grant', error_description: 'secret detail' }, 400)
         await expect(adapter().completeAuthorization(params)).rejects.toThrow('[OidcClientAdapter] Token request failed: invalid_grant.')
         routes[`${ISSUER}/token`] = () => json({ access_token: 'at', token_type: 'Bearer' })
         await expect(adapter().completeAuthorization(params)).rejects.toThrow(/no ID token/)
      })
   })

   describe('verifyIdToken()', () => {
      it('rejects a wrong nonce, audience, issuer or an expired token', async () => {
         const client = adapter()
         await expect(client.verifyIdToken(await idToken(key), 'other')).rejects.toThrow(/nonce mismatch/)
         await expect(client.verifyIdToken(await idToken(key, {}, { audience: 'someone-else' }), 'n-1')).rejects.toThrow(/ID token rejected/)
         await expect(client.verifyIdToken(await idToken(key, {}, { issuer: 'https://evil.example.org' }), 'n-1')).rejects.toThrow(/ID token rejected/)
         await expect(client.verifyIdToken(await idToken(key, {}, { expiresIn: '-10m' }), 'n-1')).rejects.toThrow(/ID token rejected/)
      })

      it('rejects a token signed by an unknown key or with a symmetric algorithm', async () => {
         const stranger = await newKey('k1')
         await expect(adapter().verifyIdToken(await idToken(stranger), 'n-1')).rejects.toThrow(/ID token rejected/)
         const symmetric = await new SignJWT({ nonce: 'n-1' })
            .setProtectedHeader({ alg: 'HS256' })
            .setSubject('user-1')
            .setIssuer(ISSUER)
            .setAudience(CLIENT_ID)
            .setExpirationTime('5m')
            .sign(new TextEncoder().encode(CLIENT_ID.padEnd(32, 'x')))
         await expect(adapter().verifyIdToken(symmetric, 'n-1')).rejects.toThrow(/ID token rejected/)
      })

      it('reloads the key set once when the provider rotated its keys', async () => {
         const client = adapter()
         await client.verifyIdToken(await idToken(key), 'n-1')
         const rotated = await newKey('k2')
         routes[`${ISSUER}/jwks`] = () => json({ keys: [rotated.jwk] })
         const claims = await client.verifyIdToken(await idToken(rotated), 'n-1')
         expect(claims.sub).toBe('user-1')
         expect(calls.filter((c) => c.url === `${ISSUER}/jwks`)).toHaveLength(2)
      })
   })

   describe('refresh, userinfo and logout', () => {
      it('refreshes tokens', async () => {
         routes[`${ISSUER}/token`] = () => json({ access_token: 'at2', token_type: 'Bearer' })
         expect((await adapter().refreshToken('rt')).access_token).toBe('at2')
         const body = new URLSearchParams(String(calls.find((c) => c.url === `${ISSUER}/token`)?.init?.body))
         expect(body.get('grant_type')).toBe('refresh_token')
         expect(body.get('refresh_token')).toBe('rt')
      })

      it('reads UserInfo with the access token', async () => {
         routes[`${ISSUER}/userinfo`] = () => json({ sub: 'user-1', email: 'user@example.org' })
         expect(await adapter().getAuthToken('at')).toEqual({ sub: 'user-1', email: 'user@example.org' })
         expect((calls.find((c) => c.url === `${ISSUER}/userinfo`)?.init?.headers as Record<string, string>).Authorization).toBe('Bearer at')
         routes[`${ISSUER}/userinfo`] = () => json({}, 401)
         await expect(adapter().getAuthToken('bad')).rejects.toThrow(/HTTP 401/)
      })

      it('builds the logout URL when the provider supports it', async () => {
         const url = new URL((await adapter().getEndSessionUrl({ idTokenHint: 'idt', postLogoutRedirectUri: 'https://app.example.org/' })) as string)
         expect(Object.fromEntries(url.searchParams)).toEqual({ client_id: CLIENT_ID, id_token_hint: 'idt', post_logout_redirect_uri: 'https://app.example.org/' })
         routes[`${ISSUER}/.well-known/openid-configuration`] = () => json({ ...METADATA, end_session_endpoint: undefined })
         expect(await adapter().getEndSessionUrl()).toBeNull()
      })
   })
})
