# @quatrain/auth-oidc-client — HOWTO

## Sign a user in (server-side web application)

```ts
import { OidcClientAdapter } from '@quatrain/auth-oidc-client'

const oidc = new OidcClientAdapter({
   config: {
      issuer: 'https://auth.example.org',
      clientId: 'acme-app',
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      scopes: ['profile', 'email'],
   },
})

// 1. Login route: redirect to the provider, keep the transient values server-side.
const request = await oidc.createAuthorizationRequest('https://app.example.org/callback')
// Store { state, nonce, codeVerifier } in a short-lived, HTTP-only, SameSite=Lax cookie
// (or a server session), then redirect the browser to request.url.

// 2. Callback route: complete the flow with the values kept at step 1.
const { tokens, claims } = await oidc.completeAuthorization({
   code: query.code,
   returnedState: query.state,
   redirectUri: 'https://app.example.org/callback',
   state: kept.state,
   nonce: kept.nonce,
   codeVerifier: kept.codeVerifier,
})
// claims.sub identifies the user at this issuer. Open your own application session here.
```

Always delete the transient cookie in the callback, whether it succeeds or fails.

## Public client (no secret)

Omit `clientSecret`. The PKCE verifier is then the only proof presented to the token endpoint, so
the client must be registered as public at the provider.

## Identify a user

Use the pair (`iss`, `sub`) as the stable key of a user. An e-mail address can change and is only
trustworthy when `email_verified` is `true`.

## Refresh and logout

```ts
const renewed = await oidc.refreshToken(tokens.refresh_token)

const logoutUrl = await oidc.getEndSessionUrl({
   idTokenHint: tokens.id_token,
   postLogoutRedirectUri: 'https://app.example.org/',
})
```

`getEndSessionUrl` returns `null` when the provider does not support RP-initiated logout: close the
application session only.

## Authorise

The adapter authenticates; it does not authorise. Decide roles in the application, from data it
controls. Do not grant a role from a claim the user can edit at the provider.
