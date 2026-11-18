/**
 * An account as persisted by a store.
 */
export interface LocalAccountInterface {
   id: string
   /** Sign-in name, lower-cased. `null` for an account that only signs in through an external identity. */
   login: string | null
   email: string | null
   name: string | null
   /** Self-describing password hash; `null` when the account has no password. */
   passwordHash: string | null
   /** Application claims (roles, …), written by the application only. */
   claims: Record<string, unknown>
   disabled: boolean
   createdAt: Date
}

/**
 * Fields of an account that can be changed after its creation.
 */
export type LocalAccountChanges = Partial<Pick<LocalAccountInterface, 'login' | 'email' | 'name' | 'passwordHash' | 'claims' | 'disabled'>>

/**
 * A session as persisted by a store. The token itself is never stored, only its digest.
 */
export interface LocalSessionInterface {
   id: string
   account: string
   tokenHash: string
   createdAt: Date
   lastSeenAt: Date
   /** Absolute end of the session, whatever its activity. */
   expiresAt: Date
}

/**
 * Raised by a store when a login is already taken.
 */
export class DuplicateLoginError extends Error {
   constructor() {
      super('Login already exists')
   }
}

/**
 * Raised by a store when an external identity already belongs to an account.
 */
export class DuplicateIdentityError extends Error {
   constructor() {
      super('Identity already linked to an account')
   }
}

/**
 * Persistence contract of {@link LocalAuthAdapter}.
 *
 * Deleting an account must delete its sessions and its identities.
 */
export interface LocalAuthStoreInterface {
   /** @throws {DuplicateLoginError} when the login is taken. */
   createAccount(account: LocalAccountInterface): Promise<void>
   findAccountById(id: string): Promise<LocalAccountInterface | null>
   findAccountByLogin(login: string): Promise<LocalAccountInterface | null>
   /**
    * @returns The updated account, or `null` when it does not exist.
    * @throws {DuplicateLoginError} when the new login is taken.
    */
   updateAccount(id: string, changes: LocalAccountChanges): Promise<LocalAccountInterface | null>
   deleteAccount(id: string): Promise<void>

   /** @throws {DuplicateIdentityError} when the identity belongs to an account already. */
   linkIdentity(issuer: string, subject: string, account: string): Promise<void>
   findAccountByIdentity(issuer: string, subject: string): Promise<LocalAccountInterface | null>

   createSession(session: LocalSessionInterface): Promise<void>
   findSessionByTokenHash(tokenHash: string): Promise<LocalSessionInterface | null>
   touchSession(id: string, lastSeenAt: Date): Promise<void>
   deleteSession(id: string): Promise<void>
   deleteSessionsOfAccount(account: string): Promise<void>
   /** @returns The number of sessions removed. */
   deleteExpiredSessions(now: Date, idleSince: Date): Promise<number>
}
