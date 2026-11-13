# @quatrain/auth-oidc-client

OpenID Connect relying-party adapter: sign users in against any standard OpenID Connect provider.

Not to be confused with [`@quatrain/auth-oidc`](../auth-oidc), which *runs* a provider.

## Installation

```bash
yarn add @quatrain/auth-oidc-client
```

## Features

- **Discovery**: endpoints and keys are read from `<issuer>/.well-known/openid-configuration` (cached).
- **Authorization code flow with PKCE (S256)**, for confidential and public clients.
- **ID token verification**: signature against the provider key set (asymmetric algorithms only),
  issuer, audience, expiry and nonce; the key set is reloaded once when the provider rotated its keys.
- **Refresh tokens**, **UserInfo** and **RP-initiated logout**.
- Error messages never contain a secret, a token or a provider response body.

Roles and permissions are deliberately out of scope: map the verified claims in your application.

## Configuration

| Key | Required | Description |
|---|---|---|
| `issuer` | yes | Issuer identifier, e.g. `https://auth.example.org` or `https://auth.example.org/realms/main`. Must use https (http is accepted for loopback hosts only). |
| `clientId` | yes | Client identifier registered at the provider. |
| `clientSecret` | no | Omit for a public client: PKCE is then the only client proof. |
| `scopes` | no | Scopes requested by default; `openid` is always added. |
| `clockToleranceSeconds` | no | Accepted clock difference with the provider (default 60). |
| `metadataTtlMs` | no | Cache lifetime of the discovery document and key set (default 1 hour). |

## API

| Method | Role |
|---|---|
| `createAuthorizationRequest(redirectUri, options?)` | Redirect URL plus the `state`, `nonce` and `codeVerifier` to keep until the callback |
| `completeAuthorization(params)` | Checks the state, exchanges the code, verifies the ID token; returns `{ tokens, claims }` |
| `verifyIdToken(idToken, nonce?)` | Verified claims of an ID token |
| `refreshToken(refreshToken)` | New tokens from a refresh token |
| `getAuthToken(accessToken)` | UserInfo claims |
| `getEndSessionUrl(options?)` | Provider logout URL, or `null` when unsupported |

All failures throw `OidcClientError`. See [HOWTO.md](HOWTO.md).

## License

AGPL-3.0-only
