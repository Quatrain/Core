import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Pool, type PoolConfig } from 'pg'
import {
   DuplicateIdentityError,
   DuplicateLoginError,
   type LocalAccountChanges,
   type LocalAccountInterface,
   type LocalAuthStoreInterface,
   type LocalSessionInterface,
} from './LocalAuthStoreInterface'

/**
 * Configuration of the PostgreSQL store.
 */
export interface PostgresLocalAuthStoreConfigInterface {
   /** Connection string, e.g. `postgres://user:password@host:5432/database`. */
   connectionString?: string
   /** Existing pool to reuse; it is then never closed by the store. */
   pool?: Pool
   /** Extra `pg` pool options (ssl, max, …), ignored when `pool` is given. */
   poolOptions?: PoolConfig
   /**
    * Create the tables on first use (default false). Leave it off when the application role
    * may not create tables, and apply `sql/auth_local.sql` with the migrations instead.
    */
   ensureSchema?: boolean
}

/** DDL of the tables, shipped with the package. */
const SCHEMA_SQL_PATH = join(__dirname, '..', 'sql', 'auth_local.sql')

/** PostgreSQL error code of a unique constraint violation. */
const UNIQUE_VIOLATION = '23505'

const ACCOUNT_COLUMNS = 'id, login, email, name, password_hash, claims, disabled, created_at'
const SESSION_COLUMNS = 'id, account, token_hash, created_at, last_seen_at, expires_at'

/** Column of each changeable account field. The keys are the only names ever placed in a statement. */
const ACCOUNT_CHANGE_COLUMNS: Record<keyof LocalAccountChanges, string> = {
   login: 'login',
   email: 'email',
   name: 'name',
   passwordHash: 'password_hash',
   claims: 'claims',
   disabled: 'disabled',
}

function toAccount(row: any): LocalAccountInterface {
   return {
      id: row.id,
      login: row.login,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      claims: row.claims ?? {},
      disabled: row.disabled,
      createdAt: row.created_at,
   }
}

function toSession(row: any): LocalSessionInterface {
   return {
      id: row.id,
      account: row.account,
      tokenHash: row.token_hash,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
   }
}

function isUniqueViolation(error: unknown): boolean {
   return typeof error === 'object' && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION
}

/**
 * Store keeping accounts, identities and sessions in PostgreSQL.
 * Every value reaches the database as a bound parameter.
 */
export class PostgresLocalAuthStore implements LocalAuthStoreInterface {
   protected _pool: Pool
   protected _ownsPool: boolean
   protected _ensureSchema: boolean
   protected _ready?: Promise<void>

   constructor(config: PostgresLocalAuthStoreConfigInterface) {
      if (config.pool) {
         this._pool = config.pool
         this._ownsPool = false
      } else if (config.connectionString) {
         this._pool = new Pool({ ...config.poolOptions, connectionString: config.connectionString })
         this._ownsPool = true
      } else {
         throw new Error('[PostgresLocalAuthStore] "connectionString" or "pool" is required.')
      }
      this._ensureSchema = config.ensureSchema ?? false
   }

   /** DDL of the tables, for an application that applies it with its own migrations. */
   static schemaSql(): string {
      return readFileSync(SCHEMA_SQL_PATH, 'utf8')
   }

   protected _prepare(): Promise<void> {
      if (!this._ensureSchema) {
         return Promise.resolve()
      }
      if (!this._ready) {
         this._ready = this._pool.query(PostgresLocalAuthStore.schemaSql()).then(() => undefined)
         this._ready.catch(() => {
            this._ready = undefined
         })
      }
      return this._ready
   }

   /** Closes the pool when the store created it. */
   async close(): Promise<void> {
      if (this._ownsPool) {
         await this._pool.end()
      }
   }

   /** Stores a new account; throws `DuplicateLoginError` when its login is taken. */
   async createAccount(account: LocalAccountInterface): Promise<void> {
      await this._prepare()
      try {
         await this._pool.query(
            `insert into auth_account (id, login, email, name, password_hash, claims, disabled, created_at, updated_at)
             values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8)`,
            [account.id, account.login, account.email, account.name, account.passwordHash, JSON.stringify(account.claims), account.disabled, account.createdAt]
         )
      } catch (error) {
         if (isUniqueViolation(error)) {
            throw new DuplicateLoginError()
         }
         throw error
      }
   }

   /** Returns the account with this identifier, or `null`. */
   async findAccountById(id: string): Promise<LocalAccountInterface | null> {
      await this._prepare()
      const result = await this._pool.query(`select ${ACCOUNT_COLUMNS} from auth_account where id = $1`, [id])
      return result.rows[0] ? toAccount(result.rows[0]) : null
   }

   /** Returns the account with this lower-cased login, or `null`. */
   async findAccountByLogin(login: string): Promise<LocalAccountInterface | null> {
      await this._prepare()
      const result = await this._pool.query(`select ${ACCOUNT_COLUMNS} from auth_account where login = $1`, [login])
      return result.rows[0] ? toAccount(result.rows[0]) : null
   }

   /** Applies the given changes and returns the account, or `null` when it does not exist. */
   async updateAccount(id: string, changes: LocalAccountChanges): Promise<LocalAccountInterface | null> {
      await this._prepare()
      const assignments: string[] = []
      const values: unknown[] = [id]
      for (const field of Object.keys(ACCOUNT_CHANGE_COLUMNS) as (keyof LocalAccountChanges)[]) {
         const value = changes[field]
         if (value === undefined) {
            continue
         }
         values.push(field === 'claims' ? JSON.stringify(value) : value)
         assignments.push(`${ACCOUNT_CHANGE_COLUMNS[field]} = $${values.length}${field === 'claims' ? '::jsonb' : ''}`)
      }
      if (assignments.length === 0) {
         return this.findAccountById(id)
      }
      try {
         const result = await this._pool.query(
            `update auth_account set ${assignments.join(', ')}, updated_at = now() where id = $1 returning ${ACCOUNT_COLUMNS}`,
            values
         )
         return result.rows[0] ? toAccount(result.rows[0]) : null
      } catch (error) {
         if (isUniqueViolation(error)) {
            throw new DuplicateLoginError()
         }
         throw error
      }
   }

   /** Deletes an account with its identities and its sessions. */
   async deleteAccount(id: string): Promise<void> {
      await this._prepare()
      await this._pool.query('delete from auth_account where id = $1', [id])
   }

   /** Attaches an external identity to an account; throws `DuplicateIdentityError` when it is already attached. */
   async linkIdentity(issuer: string, subject: string, account: string): Promise<void> {
      await this._prepare()
      try {
         await this._pool.query('insert into auth_identity (issuer, subject, account) values ($1, $2, $3)', [issuer, subject, account])
      } catch (error) {
         if (isUniqueViolation(error)) {
            throw new DuplicateIdentityError()
         }
         throw error
      }
   }

   /** Returns the account owning an external identity, or `null`. */
   async findAccountByIdentity(issuer: string, subject: string): Promise<LocalAccountInterface | null> {
      await this._prepare()
      const result = await this._pool.query(
         `select ${ACCOUNT_COLUMNS} from auth_account
          where id = (select account from auth_identity where issuer = $1 and subject = $2)`,
         [issuer, subject]
      )
      return result.rows[0] ? toAccount(result.rows[0]) : null
   }

   /** Stores a new session. */
   async createSession(session: LocalSessionInterface): Promise<void> {
      await this._prepare()
      await this._pool.query(
         `insert into auth_session (id, account, token_hash, created_at, last_seen_at, expires_at)
          values ($1, $2, $3, $4, $5, $6)`,
         [session.id, session.account, session.tokenHash, session.createdAt, session.lastSeenAt, session.expiresAt]
      )
   }

   /** Returns the session whose token has this digest, or `null`. */
   async findSessionByTokenHash(tokenHash: string): Promise<LocalSessionInterface | null> {
      await this._prepare()
      const result = await this._pool.query(`select ${SESSION_COLUMNS} from auth_session where token_hash = $1`, [tokenHash])
      return result.rows[0] ? toSession(result.rows[0]) : null
   }

   /** Records the last use of a session. */
   async touchSession(id: string, lastSeenAt: Date): Promise<void> {
      await this._prepare()
      await this._pool.query('update auth_session set last_seen_at = $2 where id = $1', [id, lastSeenAt])
   }

   /** Deletes one session. */
   async deleteSession(id: string): Promise<void> {
      await this._prepare()
      await this._pool.query('delete from auth_session where id = $1', [id])
   }

   /** Deletes every session of an account. */
   async deleteSessionsOfAccount(account: string): Promise<void> {
      await this._prepare()
      await this._pool.query('delete from auth_session where account = $1', [account])
   }

   /** Deletes the sessions past their end date or unused since `idleSince`; returns how many. */
   async deleteExpiredSessions(now: Date, idleSince: Date): Promise<number> {
      await this._prepare()
      const result = await this._pool.query('delete from auth_session where expires_at <= $1 or last_seen_at <= $2', [now, idleSince])
      return result.rowCount ?? 0
   }
}
