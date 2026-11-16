import { AuthenticationError } from '@quatrain/auth'
import { LocalAuthAdapter } from './LocalAuthAdapter'
import { DuplicateIdentityError, type LocalAuthStoreInterface } from './LocalAuthStoreInterface'
import { MemoryLocalAuthStore } from './MemoryLocalAuthStore'
import { PasswordHasher } from './PasswordHasher'
import { PostgresLocalAuthStore } from './PostgresLocalAuthStore'

/** Low cost, so the suite stays fast. Never use it outside tests. */
const fastHasher = () => new PasswordHasher({ logN: 10, blockSize: 8, parallelization: 1 })
const PASSWORD = 'correct horse battery'
const DAY = 24 * 3600

describe('PasswordHasher', () => {
   it('verifies the password it hashed and refuses another one', async () => {
      const hasher = fastHasher()
      const hash = await hasher.hash(PASSWORD)
      expect(hash).toMatch(/^\$scrypt\$ln=10,r=8,p=1\$/)
      expect(await hasher.verify(PASSWORD, hash)).toBe(true)
      expect(await hasher.verify('wrong password', hash)).toBe(false)
   })

   it('salts every hash', async () => {
      const hasher = fastHasher()
      expect(await hasher.hash(PASSWORD)).not.toEqual(await hasher.hash(PASSWORD))
   })

   it('refuses unreadable hashes and out-of-range parameters without throwing', async () => {
      const hasher = fastHasher()
      expect(await hasher.verify(PASSWORD, 'not a hash')).toBe(false)
      expect(await hasher.verify(PASSWORD, '$scrypt$ln=40,r=8,p=1$c2FsdA$a2V5')).toBe(false)
   })

   it('asks for a rehash when the cost changed', async () => {
      const hash = await fastHasher().hash(PASSWORD)
      expect(fastHasher().needsRehash(hash)).toBe(false)
      expect(new PasswordHasher({ logN: 11, blockSize: 8, parallelization: 1 }).needsRehash(hash)).toBe(true)
   })

   it('rejects invalid parameters', () => {
      expect(() => new PasswordHasher({ logN: 4 })).toThrow(/Invalid scrypt parameters/)
   })
})

function contract(label: string, makeStore: () => Promise<LocalAuthStoreInterface>, suite: jest.Describe = describe) {
   suite(`LocalAuthAdapter on ${label}`, () => {
      let store: LocalAuthStoreInterface
      let clock: Date
      let auth: LocalAuthAdapter

      beforeEach(async () => {
         store = await makeStore()
         clock = new Date('2026-01-01T00:00:00Z')
         auth = new LocalAuthAdapter({
            config: { store, hasher: fastHasher(), sessionLifetimeSeconds: 30 * DAY, sessionIdleSeconds: 7 * DAY, now: () => clock },
         })
      })

      const later = (seconds: number) => {
         clock = new Date(clock.getTime() + seconds * 1000)
      }

      it('requires a store', () => {
         expect(() => new LocalAuthAdapter({ config: {} })).toThrow(/"store" is required/)
      })

      it('creates an account and never exposes the password hash', async () => {
         const account = await auth.createAccount({ login: ' Ada@Example.org ', email: 'Ada@Example.org', name: 'Ada', password: PASSWORD })
         expect(account.login).toBe('ada@example.org')
         expect(account.hasPassword).toBe(true)
         expect(account).not.toHaveProperty('passwordHash')
         const stored = await store.findAccountById(account.id)
         expect(stored?.passwordHash).toMatch(/^\$scrypt\$/)
         expect(stored?.passwordHash).not.toContain(PASSWORD)
      })

      it('refuses a short password and a taken login', async () => {
         await expect(auth.createAccount({ login: 'ada@example.org', password: 'short' })).rejects.toThrow(AuthenticationError)
         await auth.createAccount({ login: 'ada@example.org', password: PASSWORD })
         await expect(auth.createAccount({ login: 'ADA@example.org', password: PASSWORD })).rejects.toThrow(/already exists/)
      })

      it('signs in, resolves the token and stores only its digest', async () => {
         const account = await auth.createAccount({ login: 'ada@example.org', password: PASSWORD })
         const ticket = await auth.signin('Ada@example.org', PASSWORD)
         expect(ticket.token.length).toBeGreaterThanOrEqual(43)
         expect(await store.findSessionByTokenHash(ticket.token)).toBeNull()
         const resolved = await auth.getAuthToken(ticket.token)
         expect(resolved.account.id).toBe(account.id)
      })

      it('gives one error for an unknown login, a wrong password and a disabled account', async () => {
         const account = await auth.createAccount({ login: 'ada@example.org', password: PASSWORD })
         await expect(auth.signin('nobody@example.org', PASSWORD)).rejects.toThrow('Invalid credentials')
         await expect(auth.signin('ada@example.org', 'wrong password')).rejects.toThrow('Invalid credentials')
         await auth.updateAccount(account.id, { disabled: true })
         await expect(auth.signin('ada@example.org', PASSWORD)).rejects.toThrow('Invalid credentials')
      })

      it('rehashes the password at sign-in when the cost changed', async () => {
         const account = await auth.createAccount({ login: 'ada@example.org', password: PASSWORD })
         const stronger = new LocalAuthAdapter({
            config: { store, hasher: new PasswordHasher({ logN: 11, blockSize: 8, parallelization: 1 }), now: () => clock },
         })
         await stronger.signin('ada@example.org', PASSWORD)
         expect((await store.findAccountById(account.id))?.passwordHash).toMatch(/^\$scrypt\$ln=11,/)
      })

      it('ends a session at its end date and after the idle delay', async () => {
         await auth.createAccount({ login: 'ada@example.org', password: PASSWORD })
         const idle = await auth.signin('ada@example.org', PASSWORD)
         later(7 * DAY)
         await expect(auth.getAuthToken(idle.token)).rejects.toThrow('Invalid or expired session')

         const active = await auth.signin('ada@example.org', PASSWORD)
         for (let day = 0; day < 29; day++) {
            later(DAY)
            await auth.getAuthToken(active.token)
         }
         later(DAY)
         await expect(auth.getAuthToken(active.token)).rejects.toThrow('Invalid or expired session')
      })

      it('revokes one session, or all of them on a password change', async () => {
         const account = await auth.createAccount({ login: 'ada@example.org', password: PASSWORD })
         const first = await auth.signin('ada@example.org', PASSWORD)
         const second = await auth.signin('ada@example.org', PASSWORD)
         await auth.revokeAuthToken(first.token)
         await expect(auth.getAuthToken(first.token)).rejects.toThrow(AuthenticationError)
         await auth.getAuthToken(second.token)

         await auth.updateAccount(account.id, { password: 'another long password' })
         await expect(auth.getAuthToken(second.token)).rejects.toThrow(AuthenticationError)
         await auth.signin('ada@example.org', 'another long password')
      })

      it('refuses the sessions of a disabled or deleted account', async () => {
         const account = await auth.createAccount({ login: 'ada@example.org', password: PASSWORD })
         const ticket = await auth.signin('ada@example.org', PASSWORD)
         await auth.deleteAccount(account.id)
         await expect(auth.getAuthToken(ticket.token)).rejects.toThrow(AuthenticationError)
         await expect(auth.signin('ada@example.org', PASSWORD)).rejects.toThrow('Invalid credentials')
      })

      it('purges expired sessions', async () => {
         await auth.createAccount({ login: 'ada@example.org', password: PASSWORD })
         await auth.signin('ada@example.org', PASSWORD)
         expect(await auth.purgeExpiredSessions()).toBe(0)
         later(8 * DAY)
         expect(await auth.purgeExpiredSessions()).toBe(1)
      })

      it('opens one account per external identity and never matches by e-mail', async () => {
         const local = await auth.createAccount({ login: 'ada@example.org', email: 'ada@example.org', password: PASSWORD })
         const identity = { issuer: 'https://auth.example.org', subject: 'u-1', email: 'ada@example.org', name: 'Ada' }
         expect(await auth.resolveIdentity(identity, { create: false })).toBeNull()

         const created = await auth.resolveIdentity(identity)
         expect(created?.id).not.toBe(local.id)
         expect(created?.login).toBeNull()
         expect(created?.hasPassword).toBe(false)
         expect((await auth.resolveIdentity(identity))?.id).toBe(created?.id)

         const ticket = await auth.openSession(created!.id)
         expect((await auth.getAuthToken(ticket.token)).account.id).toBe(created?.id)
      })

      it('links an identity to an existing account, once', async () => {
         const local = await auth.createAccount({ login: 'ada@example.org', password: PASSWORD })
         await auth.linkIdentity(local.id, 'https://auth.example.org', 'u-1')
         expect((await auth.resolveIdentity({ issuer: 'https://auth.example.org', subject: 'u-1' }))?.id).toBe(local.id)
         const other = await auth.createAccount({ login: 'bob@example.org', password: PASSWORD })
         await expect(auth.linkIdentity(other.id, 'https://auth.example.org', 'u-1')).rejects.toThrow(DuplicateIdentityError)
      })

      it('merges custom claims', async () => {
         const account = await auth.createAccount({ login: 'ada@example.org', password: PASSWORD, claims: { roles: ['reader'] } })
         const updated = await auth.setCustomUserClaims(account.id, { team: 'blue' })
         expect(updated.claims).toEqual({ roles: ['reader'], team: 'blue' })
      })

      it('implements the adapter contract for a User', async () => {
         const user = { _: { email: 'ada@example.org', name: 'Ada' } } as any
         const account = await auth.register(user, PASSWORD)
         expect(account.login).toBe('ada@example.org')
         const ticket = await auth.signup('ada@example.org', PASSWORD)
         await auth.signout(user)
         await expect(auth.getAuthToken(ticket.token)).rejects.toThrow(AuthenticationError)
         await auth.update(user, { name: 'Ada L.' })
         expect((await store.findAccountById(account.id))?.name).toBe('Ada L.')
         await auth.delete(user)
         expect(await store.findAccountById(account.id)).toBeNull()
         await expect(auth.refreshToken('x')).rejects.toThrow(AuthenticationError)
      })
   })
}

contract('the memory store', async () => new MemoryLocalAuthStore())

/**
 * Integration tests: they need a PostgreSQL database and are skipped without one.
 *   AUTH_LOCAL_TEST_URL=postgres://postgres@127.0.0.1:5432/auth_test yarn jest packages/auth-local
 */
const URL = process.env.AUTH_LOCAL_TEST_URL
let postgresStore: PostgresLocalAuthStore | undefined

contract(
   'PostgreSQL',
   async () => {
      postgresStore ??= new PostgresLocalAuthStore({ connectionString: URL, ensureSchema: true })
      await (postgresStore as any)._prepare()
      await (postgresStore as any)._pool.query('truncate auth_session, auth_identity, auth_account')
      return postgresStore
   },
   URL ? describe : describe.skip
)

afterAll(async () => {
   await postgresStore?.close()
})

describe('PostgresLocalAuthStore configuration', () => {
   it('requires a connection string or a pool', () => {
      expect(() => new PostgresLocalAuthStore({})).toThrow(/"connectionString" or "pool" is required/)
   })
})

describe('LocalAuthAdapter concurrent first sign-ins', () => {
   it('keeps a single account for an identity', async () => {
      const store = new MemoryLocalAuthStore()
      const auth = new LocalAuthAdapter({ config: { store, hasher: fastHasher() } })
      const identity = { issuer: 'https://auth.example.org', subject: 'u-1' }
      const [first, second] = await Promise.all([auth.resolveIdentity(identity), auth.resolveIdentity(identity)])
      expect(first?.id).toBe(second?.id)
      expect((store as any)._accounts.size).toBe(1)
   })
})
