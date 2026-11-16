# @quatrain/auth-local — HOWTO

## Set up

```ts
import { LocalAuthAdapter, PostgresLocalAuthStore } from '@quatrain/auth-local'

const auth = new LocalAuthAdapter({
   config: {
      store: new PostgresLocalAuthStore({ connectionString: process.env.DATABASE_URL }),
   },
})
```

Create the tables with your migrations, from the DDL shipped in `sql/auth_local.sql`
(`PostgresLocalAuthStore.schemaSql()` returns it). `ensureSchema: true` creates them on first use
instead, which needs a database role allowed to create tables.

## Sign in with a password

```ts
await auth.createAccount({ login: 'ada@example.org', email: 'ada@example.org', password })

const { token, expiresAt } = await auth.signin(login, password)
// Send the token in a cookie: HttpOnly, Secure, SameSite=Lax, expiring at expiresAt.
```

`signin` throws the same `AuthenticationError` whatever the reason. Do not tell the user more, and
limit the number of attempts per login and per address in the application.

## Authenticate a request

```ts
try {
   const { account } = await auth.getAuthToken(cookieToken)
   // account.id, account.claims…
} catch {
   // Not signed in: delete the cookie.
}
```

## Sign in through an external provider

After the provider verified the user (see `@quatrain/auth-oidc-client`):

```ts
const account = await auth.resolveIdentity({
   issuer: claims.iss,
   subject: claims.sub,
   email: claims.email_verified ? claims.email : undefined,
   name: claims.name,
})
const { token, expiresAt } = await auth.openSession(account.id)
```

Pass `{ create: false }` to refuse identities that have no account yet, e.g. when accounts are
created by an administrator and attached with `linkIdentity`.

An account created this way has no login and no password. It is distinct from a password account
holding the same e-mail address: matching them automatically would let whoever controls an
address at the provider take over the local account.

## Sign out

```ts
await auth.revokeAuthToken(cookieToken)   // this session
await auth.closeSessions(account.id)      // every session of the account
```

Changing the password or disabling the account closes every session by itself.

## Roles

Store what the application decides in `claims` (`setCustomUserClaims`). They are written by the
application only: nothing a user sends reaches them.

## Housekeeping

Expired sessions are refused whether they are still stored or not. Run `purgeExpiredSessions()`
from a scheduled task to remove them.

## Raise the hashing cost

```ts
new LocalAuthAdapter({ config: { store, hasher: new PasswordHasher({ logN: 16 }) } })
```

Existing passwords keep working and are rehashed at their next successful sign-in.
