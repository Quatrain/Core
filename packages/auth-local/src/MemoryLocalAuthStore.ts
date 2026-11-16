import {
   DuplicateIdentityError,
   DuplicateLoginError,
   type LocalAccountChanges,
   type LocalAccountInterface,
   type LocalAuthStoreInterface,
   type LocalSessionInterface,
} from './LocalAuthStoreInterface'

function identityKey(issuer: string, subject: string): string {
   return JSON.stringify([issuer, subject])
}

/**
 * In-memory store, for tests and local development. Nothing survives the process.
 */
export class MemoryLocalAuthStore implements LocalAuthStoreInterface {
   protected _accounts = new Map<string, LocalAccountInterface>()
   protected _identities = new Map<string, string>()
   protected _sessions = new Map<string, LocalSessionInterface>()

   protected _copy(account: LocalAccountInterface | undefined): LocalAccountInterface | null {
      return account ? { ...account, claims: { ...account.claims } } : null
   }

   protected _loginTaken(login: string | null, except?: string): boolean {
      if (login === null) {
         return false
      }
      for (const account of this._accounts.values()) {
         if (account.login === login && account.id !== except) {
            return true
         }
      }
      return false
   }

   /** Stores a new account; throws `DuplicateLoginError` when its login is taken. */
   async createAccount(account: LocalAccountInterface): Promise<void> {
      if (this._loginTaken(account.login)) {
         throw new DuplicateLoginError()
      }
      this._accounts.set(account.id, { ...account, claims: { ...account.claims } })
   }

   /** Returns the account with this identifier, or `null`. */
   async findAccountById(id: string): Promise<LocalAccountInterface | null> {
      return this._copy(this._accounts.get(id))
   }

   /** Returns the account with this lower-cased login, or `null`. */
   async findAccountByLogin(login: string): Promise<LocalAccountInterface | null> {
      for (const account of this._accounts.values()) {
         if (account.login === login) {
            return this._copy(account)
         }
      }
      return null
   }

   /** Applies the given changes and returns the account, or `null` when it does not exist. */
   async updateAccount(id: string, changes: LocalAccountChanges): Promise<LocalAccountInterface | null> {
      const account = this._accounts.get(id)
      if (!account) {
         return null
      }
      if (changes.login !== undefined && this._loginTaken(changes.login, id)) {
         throw new DuplicateLoginError()
      }
      const updated = { ...account, ...changes }
      this._accounts.set(id, updated)
      return this._copy(updated)
   }

   /** Deletes an account with its identities and its sessions. */
   async deleteAccount(id: string): Promise<void> {
      this._accounts.delete(id)
      for (const [key, account] of this._identities) {
         if (account === id) {
            this._identities.delete(key)
         }
      }
      await this.deleteSessionsOfAccount(id)
   }

   /** Attaches an external identity to an account; throws `DuplicateIdentityError` when it is already attached. */
   async linkIdentity(issuer: string, subject: string, account: string): Promise<void> {
      const key = identityKey(issuer, subject)
      if (this._identities.has(key)) {
         throw new DuplicateIdentityError()
      }
      this._identities.set(key, account)
   }

   /** Returns the account owning an external identity, or `null`. */
   async findAccountByIdentity(issuer: string, subject: string): Promise<LocalAccountInterface | null> {
      const id = this._identities.get(identityKey(issuer, subject))
      return id ? this._copy(this._accounts.get(id)) : null
   }

   /** Stores a new session. */
   async createSession(session: LocalSessionInterface): Promise<void> {
      this._sessions.set(session.id, { ...session })
   }

   /** Returns the session whose token has this digest, or `null`. */
   async findSessionByTokenHash(tokenHash: string): Promise<LocalSessionInterface | null> {
      for (const session of this._sessions.values()) {
         if (session.tokenHash === tokenHash) {
            return { ...session }
         }
      }
      return null
   }

   /** Records the last use of a session. */
   async touchSession(id: string, lastSeenAt: Date): Promise<void> {
      const session = this._sessions.get(id)
      if (session) {
         session.lastSeenAt = lastSeenAt
      }
   }

   /** Deletes one session. */
   async deleteSession(id: string): Promise<void> {
      this._sessions.delete(id)
   }

   /** Deletes every session of an account. */
   async deleteSessionsOfAccount(account: string): Promise<void> {
      for (const [id, session] of this._sessions) {
         if (session.account === account) {
            this._sessions.delete(id)
         }
      }
   }

   /** Deletes the sessions past their end date or unused since `idleSince`; returns how many. */
   async deleteExpiredSessions(now: Date, idleSince: Date): Promise<number> {
      let removed = 0
      for (const [id, session] of this._sessions) {
         if (session.expiresAt <= now || session.lastSeenAt <= idleSince) {
            this._sessions.delete(id)
            removed++
         }
      }
      return removed
   }
}
