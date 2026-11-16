import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { AbstractAuthAdapter, Auth, AuthenticationError, type AuthParameters } from '@quatrain/auth'
import type { User } from '@quatrain/backend'
import { PasswordHasher } from './PasswordHasher'
import {
   DuplicateIdentityError,
   DuplicateLoginError,
   type LocalAccountChanges,
   type LocalAccountInterface,
   type LocalAuthStoreInterface,
} from './LocalAuthStoreInterface'

/**
 * Configuration of {@link LocalAuthAdapter}, given as `params.config`.
 */
export interface LocalAuthConfigInterface {
   /** Where accounts, identities and sessions are kept. */
   store: LocalAuthStoreInterface
   /** Password hasher (default: scrypt with the default cost). */
   hasher?: PasswordHasher
   /** Absolute lifetime of a session, in seconds (default 30 days). */
   sessionLifetimeSeconds?: number
   /** A session unused for this long is closed, in seconds (default 7 days). */
   sessionIdleSeconds?: number
   /** Minimum password length, in characters (default 12). */
   minPasswordLength?: number
   /** Clock, for tests. */
   now?: () => Date
}

/**
 * An account as handed to the application: the password hash never leaves the adapter.
 */
export interface LocalAccountViewInterface extends Omit<LocalAccountInterface, 'passwordHash'> {
   hasPassword: boolean
}

/**
 * A freshly opened session. `token` exists only here: keep it in an HTTP-only cookie.
 */
export interface LocalSessionTicketInterface {
   token: string
   expiresAt: Date
   account: LocalAccountViewInterface
}

/**
 * Data of a new account.
 */
export interface LocalAccountInputInterface {
   /** Sign-in name; lower-cased and trimmed. Omit for an account without password sign-in. */
   login?: string
   email?: string
   name?: string
   password?: string
   claims?: Record<string, unknown>
}

/**
 * An identity verified by an external provider, e.g. the claims of an OpenID Connect ID token.
 */
export interface ExternalIdentityInterface {
   issuer: string
   subject: string
   email?: string
   name?: string
}

/** Longest password accepted, so that hashing cannot be used to exhaust the process. */
const MAX_PASSWORD_LENGTH = 1024
/** `last_seen_at` is written at most once per this delay, to spare a write at every request. */
const TOUCH_INTERVAL_MS = 60_000
const INVALID_CREDENTIALS = 'Invalid credentials'
const INVALID_SESSION = 'Invalid or expired session'

function normalizeLogin(login: string): string {
   return login.trim().toLowerCase()
}

function digest(token: string): string {
   return createHash('sha256').update(token).digest('hex')
}

function toView(account: LocalAccountInterface): LocalAccountViewInterface {
   const { passwordHash, ...view } = account
   return { ...view, hasPassword: passwordHash !== null }
}

/**
 * Authentication adapter keeping accounts and sessions in the application's own storage.
 *
 * - Passwords are hashed with scrypt and rehashed transparently when the cost changes.
 * - A session is an opaque random token; only its SHA-256 digest is stored, so a leaked
 *   table gives no usable token. Sessions end at an absolute date and after an idle delay.
 * - An account can be opened from an external identity (issuer, subject). It is never
 *   attached to an existing account because the e-mail addresses match.
 *
 * Rate limiting of sign-in attempts is left to the application.
 */
export class LocalAuthAdapter extends AbstractAuthAdapter {
   protected _store: LocalAuthStoreInterface
   protected _hasher: PasswordHasher
   protected _sessionLifetimeMs: number
   protected _sessionIdleMs: number
   protected _minPasswordLength: number
   protected _now: () => Date
   protected _decoyHash?: Promise<string>

   constructor(params: AuthParameters = {}) {
      super(params)
      const config = (params.config || {}) as Partial<LocalAuthConfigInterface>
      if (!config.store) {
         throw new Error('[LocalAuthAdapter] "store" is required.')
      }
      this._store = config.store
      this._hasher = config.hasher ?? new PasswordHasher()
      this._sessionLifetimeMs = (config.sessionLifetimeSeconds ?? 30 * 24 * 3600) * 1000
      this._sessionIdleMs = (config.sessionIdleSeconds ?? 7 * 24 * 3600) * 1000
      this._minPasswordLength = config.minPasswordLength ?? 12
      this._now = config.now ?? (() => new Date())
      if (this._sessionLifetimeMs <= 0 || this._sessionIdleMs <= 0 || this._minPasswordLength < 8) {
         throw new Error('[LocalAuthAdapter] Session delays must be positive and "minPasswordLength" at least 8.')
      }
   }

   protected _checkPassword(password: string): void {
      if (typeof password !== 'string' || password.length < this._minPasswordLength || password.length > MAX_PASSWORD_LENGTH) {
         throw new AuthenticationError(Auth.ERROR_WEAK_PASSWORD)
      }
   }

   protected async _requireAccount(id: string): Promise<LocalAccountInterface> {
      const account = await this._store.findAccountById(id)
      if (!account) {
         throw new AuthenticationError('Unknown account')
      }
      return account
   }

   /**
    * Creates an account.
    *
    * @param input - Login, password and profile of the account.
    * @returns The account, without its password hash.
    * @throws {AuthenticationError} `Auth.ERROR_WEAK_PASSWORD` or `Auth.ERROR_EMAIL_EXISTS`.
    */
   async createAccount(input: LocalAccountInputInterface): Promise<LocalAccountViewInterface> {
      const login = input.login ? normalizeLogin(input.login) : null
      if (input.password !== undefined) {
         if (!login) {
            throw new AuthenticationError('A password needs a login')
         }
         this._checkPassword(input.password)
      }
      const account: LocalAccountInterface = {
         id: randomUUID(),
         login,
         email: input.email ? input.email.trim().toLowerCase() : null,
         name: input.name ?? null,
         passwordHash: input.password === undefined ? null : await this._hasher.hash(input.password),
         claims: input.claims ?? {},
         disabled: false,
         createdAt: this._now(),
      }
      try {
         await this._store.createAccount(account)
      } catch (error) {
         if (error instanceof DuplicateLoginError) {
            throw new AuthenticationError(Auth.ERROR_EMAIL_EXISTS)
         }
         throw error
      }
      return toView(account)
   }

   /**
    * Opens a session for an account whose identity the caller has already verified.
    *
    * @param accountId - Identifier of the account.
    * @returns The session token and its end date.
    */
   async openSession(accountId: string): Promise<LocalSessionTicketInterface> {
      const account = await this._requireAccount(accountId)
      if (account.disabled) {
         throw new AuthenticationError(INVALID_CREDENTIALS)
      }
      const token = randomBytes(32).toString('base64url')
      const now = this._now()
      const expiresAt = new Date(now.getTime() + this._sessionLifetimeMs)
      await this._store.createSession({
         id: randomUUID(),
         account: account.id,
         tokenHash: digest(token),
         createdAt: now,
         lastSeenAt: now,
         expiresAt,
      })
      return { token, expiresAt, account: toView(account) }
   }

   /**
    * Signs a user in with a login and a password.
    *
    * An unknown login, a wrong password and a disabled account give the same error and take
    * the same time, so the answer does not reveal which logins exist.
    *
    * @param login - Sign-in name.
    * @param password - Clear password.
    * @returns The session token and its end date.
    * @throws {AuthenticationError} when the credentials are refused.
    */
   async signin(login: string, password: string): Promise<LocalSessionTicketInterface> {
      const candidate = typeof password === 'string' && password.length <= MAX_PASSWORD_LENGTH ? password : ''
      const account = typeof login === 'string' ? await this._store.findAccountByLogin(normalizeLogin(login)) : null
      if (!account || account.passwordHash === null) {
         this._decoyHash ??= this._hasher.hash(randomBytes(16).toString('hex'))
         await this._hasher.verify(candidate, await this._decoyHash)
         throw new AuthenticationError(INVALID_CREDENTIALS)
      }
      const matches = await this._hasher.verify(candidate, account.passwordHash)
      if (!matches || account.disabled) {
         throw new AuthenticationError(INVALID_CREDENTIALS)
      }
      if (this._hasher.needsRehash(account.passwordHash)) {
         await this._store.updateAccount(account.id, { passwordHash: await this._hasher.hash(candidate) })
      }
      return this.openSession(account.id)
   }

   /**
    * Finds the account of an external identity, creating it at the first sign-in.
    *
    * The new account has no login and no password. An existing account is never matched
    * by e-mail: attach an identity to it explicitly with {@link LocalAuthAdapter.linkIdentity}.
    *
    * @param identity - Identity verified by the provider.
    * @param options - `create: false` refuses unknown identities instead of creating an account.
    * @returns The account, or `null` when it is unknown and `create` is `false`.
    */
   async resolveIdentity(identity: ExternalIdentityInterface, options: { create?: boolean } = {}): Promise<LocalAccountViewInterface | null> {
      if (!identity.issuer || !identity.subject) {
         throw new AuthenticationError('An identity needs an issuer and a subject')
      }
      const known = await this._store.findAccountByIdentity(identity.issuer, identity.subject)
      if (known) {
         return toView(known)
      }
      if (options.create === false) {
         return null
      }
      const account = await this.createAccount({ email: identity.email, name: identity.name })
      try {
         await this._store.linkIdentity(identity.issuer, identity.subject, account.id)
      } catch (error) {
         if (!(error instanceof DuplicateIdentityError)) {
            throw error
         }
         // Two first sign-ins of the same identity ran together: keep the account that won.
         await this._store.deleteAccount(account.id)
         const winner = await this._store.findAccountByIdentity(identity.issuer, identity.subject)
         return winner ? toView(winner) : null
      }
      return account
   }

   /**
    * Attaches an external identity to an existing account.
    *
    * @throws {DuplicateIdentityError} when the identity belongs to an account already.
    */
   async linkIdentity(accountId: string, issuer: string, subject: string): Promise<void> {
      const account = await this._requireAccount(accountId)
      await this._store.linkIdentity(issuer, subject, account.id)
   }

   /**
    * Changes an account. A new password or a disabled account closes every session of the account.
    *
    * @param accountId - Identifier of the account.
    * @param changes - `login`, `email`, `name`, `password`, `claims` (replaces them) or `disabled`.
    * @returns The updated account.
    */
   async updateAccount(
      accountId: string,
      changes: { login?: string; email?: string | null; name?: string | null; password?: string; claims?: Record<string, unknown>; disabled?: boolean }
   ): Promise<LocalAccountViewInterface> {
      const account = await this._requireAccount(accountId)
      const stored: LocalAccountChanges = {}
      if (changes.login !== undefined) {
         stored.login = normalizeLogin(changes.login)
      }
      if (changes.email !== undefined) {
         stored.email = changes.email ? changes.email.trim().toLowerCase() : null
      }
      if (changes.name !== undefined) {
         stored.name = changes.name
      }
      if (changes.claims !== undefined) {
         stored.claims = changes.claims
      }
      if (changes.disabled !== undefined) {
         stored.disabled = changes.disabled
      }
      if (changes.password !== undefined) {
         if (!(stored.login ?? account.login)) {
            throw new AuthenticationError('A password needs a login')
         }
         this._checkPassword(changes.password)
         stored.passwordHash = await this._hasher.hash(changes.password)
      }
      let updated: LocalAccountInterface | null
      try {
         updated = await this._store.updateAccount(account.id, stored)
      } catch (error) {
         if (error instanceof DuplicateLoginError) {
            throw new AuthenticationError(Auth.ERROR_EMAIL_EXISTS)
         }
         throw error
      }
      if (!updated) {
         throw new AuthenticationError('Unknown account')
      }
      if (stored.passwordHash !== undefined || stored.disabled === true) {
         await this._store.deleteSessionsOfAccount(account.id)
      }
      return toView(updated)
   }

   /** Deletes an account, its identities and its sessions. */
   async deleteAccount(accountId: string): Promise<void> {
      await this._store.deleteAccount(accountId)
   }

   /** Closes every session of an account. */
   async closeSessions(accountId: string): Promise<void> {
      await this._store.deleteSessionsOfAccount(accountId)
   }

   /**
    * Removes the sessions that reached their end date or their idle delay.
    * Call it from a scheduled task; expired sessions are refused whether purged or not.
    *
    * @returns The number of sessions removed.
    */
   async purgeExpiredSessions(): Promise<number> {
      const now = this._now()
      return this._store.deleteExpiredSessions(now, new Date(now.getTime() - this._sessionIdleMs))
   }

   protected async _accountOfUser(user: User): Promise<LocalAccountInterface> {
      const login = (user as any)?._?.email
      const account = typeof login === 'string' ? await this._store.findAccountByLogin(normalizeLogin(login)) : null
      if (!account) {
         throw new AuthenticationError('Unknown account')
      }
      return account
   }

   /**
    * Creates the account of a `User`, signed in by its e-mail address.
    *
    * @param user - User whose `email` and `name` are read.
    * @param clearPassword - Password of the account; omit for an account without password.
    */
   async register(user: User, clearPassword?: string): Promise<LocalAccountViewInterface> {
      const data = (user as any)?._ ?? {}
      return this.createAccount({ login: data.email, email: data.email, name: data.name, password: clearPassword })
   }

   /** Signs a user in; same as {@link LocalAuthAdapter.signin} (name kept from the adapter contract). */
   async signup(login: string, password: string): Promise<LocalSessionTicketInterface> {
      return this.signin(login, password)
   }

   /** Closes every session of the account of a `User`. */
   async signout(user: User): Promise<void> {
      const account = await this._accountOfUser(user)
      await this.closeSessions(account.id)
   }

   /** Changes the account of a `User`; see {@link LocalAuthAdapter.updateAccount}. */
   async update(user: User, updatable: any): Promise<LocalAccountViewInterface> {
      const account = await this._accountOfUser(user)
      return this.updateAccount(account.id, updatable ?? {})
   }

   /** Deletes the account of a `User`. */
   async delete(user: User): Promise<void> {
      const account = await this._accountOfUser(user)
      await this.deleteAccount(account.id)
   }

   /**
    * Resolves a session token to its account.
    *
    * @param token - Session token received from the client.
    * @returns The account and the end date of the session.
    * @throws {AuthenticationError} when the token is unknown, expired, idle or its account disabled.
    */
   async getAuthToken(token: string): Promise<{ account: LocalAccountViewInterface; expiresAt: Date }> {
      if (typeof token !== 'string' || token.length === 0 || token.length > 256) {
         throw new AuthenticationError(INVALID_SESSION)
      }
      const session = await this._store.findSessionByTokenHash(digest(token))
      if (!session) {
         throw new AuthenticationError(INVALID_SESSION)
      }
      const now = this._now()
      const idleFor = now.getTime() - session.lastSeenAt.getTime()
      if (session.expiresAt <= now || idleFor >= this._sessionIdleMs) {
         await this._store.deleteSession(session.id)
         throw new AuthenticationError(INVALID_SESSION)
      }
      const account = await this._store.findAccountById(session.account)
      if (!account || account.disabled) {
         await this._store.deleteSession(session.id)
         throw new AuthenticationError(INVALID_SESSION)
      }
      if (idleFor >= TOUCH_INTERVAL_MS) {
         await this._store.touchSession(session.id, now)
      }
      return { account: toView(account), expiresAt: session.expiresAt }
   }

   /** Opaque sessions are not refreshed: they slide with activity until their end date. */
   async refreshToken(_refreshToken: string): Promise<never> {
      throw new AuthenticationError('Sessions of this adapter have no refresh token')
   }

   /** Closes the session of a token. Unknown tokens are ignored. */
   async revokeAuthToken(token: string): Promise<void> {
      if (typeof token !== 'string' || token.length === 0 || token.length > 256) {
         return
      }
      const session = await this._store.findSessionByTokenHash(digest(token))
      if (session) {
         await this._store.deleteSession(session.id)
      }
   }

   /** Merges claims into those of an account. */
   async setCustomUserClaims(id: string, claims: Record<string, unknown>): Promise<LocalAccountViewInterface> {
      const account = await this._requireAccount(id)
      return this.updateAccount(id, { claims: { ...account.claims, ...claims } })
   }
}
