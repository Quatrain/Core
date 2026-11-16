# @quatrain/auth-local

Local accounts and server-side sessions: an adapter of [`@quatrain/auth`](../auth) for an application
that keeps its users itself instead of delegating them to a hosted service.

It also gives an application session to users signed in through an external provider, e.g. with
[`@quatrain/auth-oidc-client`](../auth-oidc-client).

## Installation

```bash
yarn add @quatrain/auth-local
```

## Features

- **Password accounts** hashed with scrypt. The hash string carries its own parameters, so the cost
  can be raised later: passwords are rehashed at the next successful sign-in.
- **Opaque sessions**: a random 256-bit token, of which only the SHA-256 digest is stored. A session
  ends at an absolute date and after an idle delay, and can be revoked alone or with all the sessions
  of its account.
- **Accounts opened from an external identity** (`issuer`, `subject`). An existing account is never
  matched by e-mail address; linking is an explicit call.
- **No account enumeration**: an unknown login, a wrong password and a disabled account give the
  same error after the same work.
- **Storage behind an interface**, with a PostgreSQL store (DDL shipped) and an in-memory store for tests.

Out of scope: password recovery, multi-factor authentication and rate limiting of sign-in attempts.

## Configuration

Given as `config` to `new LocalAuthAdapter({ config })`.

| Key | Required | Description |
|---|---|---|
| `store` | yes | A `LocalAuthStoreInterface`: `PostgresLocalAuthStore`, `MemoryLocalAuthStore` or your own. |
| `hasher` | no | A `PasswordHasher`; default scrypt with N = 2^15, r = 8, p = 3. |
| `sessionLifetimeSeconds` | no | Absolute lifetime of a session (default 30 days). |
| `sessionIdleSeconds` | no | Idle delay after which a session is closed (default 7 days). |
| `minPasswordLength` | no | Minimum password length (default 12, at least 8). |

`PostgresLocalAuthStore` takes `connectionString` or an existing `pool`, and `ensureSchema`
(default `false`) to create the tables on first use.

## API

| Method | Role |
|---|---|
| `createAccount(input)` | New account, with or without a password |
| `signin(login, password)` | Session ticket `{ token, expiresAt, account }` |
| `resolveIdentity(identity, { create })` | Account of an external identity, created at the first sign-in |
| `linkIdentity(accountId, issuer, subject)` | Attaches an external identity to an existing account |
| `openSession(accountId)` | Session ticket for an account already authenticated by the caller |
| `getAuthToken(token)` | Account of a session token |
| `revokeAuthToken(token)` / `closeSessions(accountId)` | Ends one session / all the sessions of an account |
| `updateAccount(accountId, changes)` | Changes an account; a new password or `disabled` closes its sessions |
| `setCustomUserClaims(accountId, claims)` | Merges application claims |
| `deleteAccount(accountId)` | Deletes an account, its identities and its sessions |
| `purgeExpiredSessions()` | Housekeeping, for a scheduled task |

Refused credentials and sessions throw `AuthenticationError` from `@quatrain/auth`.
See [HOWTO.md](HOWTO.md).

## License

AGPL-3.0-only
