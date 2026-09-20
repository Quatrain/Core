import {
   Config,
   ConfigContainer,
   ConfigurationError,
   EnvConfigSource,
   ObjectConfigSource,
   MemoryConfigSource,
} from '../index'

describe('@quatrain/config', () => {
   beforeEach(() => {
      Config.clear()
   })

   afterEach(() => {
      Config.clear()
   })

   describe('Registry Operations & Tool Isolation', () => {
      it('registers and retrieves tool configs independently', () => {
         Config.addConfig('odoo', {
            url: 'https://odoo.example.com',
            database: 'prod_db',
            apiKey: 'odoo-secret-key',
         })

         Config.addConfig('google-drive', {
            clientId: 'gdrive-client-123',
            clientSecret: 'gdrive-secret-456',
         })

         Config.addConfig('supabase', {
            url: 'https://xyz.supabase.co',
            serviceKey: 'sb-secret-789',
         })

         expect(Config.hasConfig('odoo')).toBe(true)
         expect(Config.hasConfig('google-drive')).toBe(true)
         expect(Config.hasConfig('supabase')).toBe(true)
         expect(Config.hasConfig('unknown-tool')).toBe(false)

         const odooConfig = Config.getConfig('odoo')
         const gdriveConfig = Config.getConfig('google-drive')
         const supabaseConfig = Config.getConfig('supabase')

         expect(odooConfig.requireString('url')).toBe('https://odoo.example.com')
         expect(odooConfig.requireString('apiKey')).toBe('odoo-secret-key')

         expect(gdriveConfig.requireString('clientId')).toBe('gdrive-client-123')
         expect(supabaseConfig.requireString('url')).toBe('https://xyz.supabase.co')
      })

      it('throws ConfigurationError when accessing an unregistered custom alias', () => {
         expect(() => Config.getConfig('unregistered-service')).toThrow(
            ConfigurationError,
         )
         expect(() => Config.getConfig('unregistered-service')).toThrow(
            /No configuration registered under alias "unregistered-service"/,
         )
      })

      it('removes a registered configuration container', () => {
         Config.addConfig('temporary', { token: '123' })
         expect(Config.hasConfig('temporary')).toBe(true)

         const removed = Config.removeConfig('temporary')
         expect(removed).toBe(true)
         expect(Config.hasConfig('temporary')).toBe(false)
         expect(Config.removeConfig('temporary')).toBe(false)
      })

      it('allows setting a custom default alias', () => {
         Config.addConfig('app-main', { port: 8080 }, true)
         expect(Config.defaultConfig).toBe('app-main')

         const defaultContainer = Config.getConfig()
         expect(defaultContainer.namespace).toBe('app-main')
         expect(defaultContainer.requireNumber('port')).toBe(8080)
      })

      it('registers an existing ConfigContainer directly', () => {
         const customContainer = new ConfigContainer('custom-ns')
         customContainer.set('feature.enabled', true)

         Config.addConfig('custom', customContainer)
         expect(Config.getConfig('custom')).toBe(customContainer)
         expect(Config.getConfig('custom').requireBoolean('feature.enabled')).toBe(true)
      })
   })

   describe('Global Shortcuts & Fail-Fast Validations', () => {
      it('gets, sets and requires values on the default container', () => {
         Config.set('appName', 'QuatrainApp')
         Config.set('server.port', 3000)
         Config.set('server.ssl', true)
         Config.set('allowedHosts', ['localhost', 'example.com'])
         Config.set('environment', 'production')

         expect(Config.get('appName')).toBe('QuatrainApp')
         expect(Config.getString('appName')).toBe('QuatrainApp')
         expect(Config.requireString('appName')).toBe('QuatrainApp')

         expect(Config.get('server.port')).toBe(3000)
         expect(Config.getNumber('server.port')).toBe(3000)
         expect(Config.requireNumber('server.port')).toBe(3000)

         expect(Config.getBoolean('server.ssl')).toBe(true)
         expect(Config.requireBoolean('server.ssl')).toBe(true)

         expect(Config.requireArray('allowedHosts')).toEqual(['localhost', 'example.com'])
         expect(
            Config.requireEnum('environment', ['development', 'staging', 'production'] as const),
         ).toBe('production')
      })

      it('returns fallback value if key is not defined', () => {
         expect(Config.get('missingKey', 'fallbackVal')).toBe('fallbackVal')
         expect(Config.getString('missingKey', 'defaultString')).toBe('defaultString')
         expect(Config.getNumber('missingKey', 9000)).toBe(9000)
         expect(Config.getBoolean('missingKey', false)).toBe(false)
      })

      it('delegates to specified alias when alias argument is provided', () => {
         Config.addConfig('crm', { tenantId: 'tenant-42' })

         const crmContainer = Config.getConfig('crm')
         expect(crmContainer.get('tenantId')).toBe('tenant-42')
         expect(crmContainer.requireString('tenantId')).toBe('tenant-42')
      })

      it('throws ConfigurationError on missing required parameter with guidance', () => {
         expect(() =>
            Config.require('DATABASE_URL', 'Set DATABASE_URL in your .env file'),
         ).toThrow(ConfigurationError)

         try {
            Config.require('DATABASE_URL', 'Set DATABASE_URL in your .env file')
         } catch (err) {
            const error = err as ConfigurationError
            expect(error.name).toBe('ConfigurationError')
            expect(error.key).toBe('DATABASE_URL')
            expect(error.namespace).toBe('@default')
            expect(error.message).toContain('Set DATABASE_URL in your .env file')
         }
      })

      it('throws ConfigurationError on empty string for required values', () => {
         Config.set('API_KEY', '   ')
         expect(() => Config.require('API_KEY')).toThrow(/cannot be an empty string/)
         expect(() => Config.requireString('API_KEY')).toThrow(/cannot be an empty string/)
      })

      it('validates numbers and handles string numeric conversions', () => {
         Config.set('PORT_NUM', 4000)
         Config.set('PORT_STR', '5000')
         Config.set('PORT_INVALID', 'not-a-number')

         expect(Config.requireNumber('PORT_NUM')).toBe(4000)
         expect(Config.requireNumber('PORT_STR')).toBe(5000)

         expect(() => Config.requireNumber('PORT_INVALID')).toThrow(
            /Expected numeric value/,
         )
      })

      it('validates booleans and handles string representations', () => {
         Config.set('FLAG_TRUE', true)
         Config.set('FLAG_FALSE', false)
         Config.set('FLAG_STR_TRUE', 'true')
         Config.set('FLAG_STR_1', '1')
         Config.set('FLAG_STR_FALSE', 'false')
         Config.set('FLAG_STR_0', '0')
         Config.set('FLAG_INVALID', 'maybe')

         expect(Config.requireBoolean('FLAG_TRUE')).toBe(true)
         expect(Config.requireBoolean('FLAG_FALSE')).toBe(false)
         expect(Config.requireBoolean('FLAG_STR_TRUE')).toBe(true)
         expect(Config.requireBoolean('FLAG_STR_1')).toBe(true)
         expect(Config.requireBoolean('FLAG_STR_FALSE')).toBe(false)
         expect(Config.requireBoolean('FLAG_STR_0')).toBe(false)

         expect(() => Config.requireBoolean('FLAG_INVALID')).toThrow(
            /Expected boolean value/,
         )
      })

      it('validates arrays and enums', () => {
         Config.set('ROLES', ['admin', 'curator'])
         Config.set('NOT_ARRAY', 'admin,curator')

         expect(Config.requireArray('ROLES')).toEqual(['admin', 'curator'])
         expect(() => Config.requireArray('NOT_ARRAY')).toThrow(/Expected array value/)

         Config.set('LOG_LEVEL', 'debug')
         expect(
            Config.requireEnum('LOG_LEVEL', ['debug', 'info', 'warn', 'error'] as const),
         ).toBe('debug')

         Config.set('LOG_LEVEL_INVALID', 'verbose')
         expect(() =>
            Config.requireEnum(
               'LOG_LEVEL_INVALID',
               ['debug', 'info', 'warn', 'error'] as const,
            ),
         ).toThrow(/Value "verbose" is invalid. Allowed options are:/)
      })
   })

   describe('Sub-Scoping & Dot Notation', () => {
      it('returns registered container if alias exists in Config.scope()', () => {
         Config.addConfig('odoo', { apiKey: 'secret' })
         const scoped = Config.scope('odoo')
         expect(scoped.namespace).toBe('odoo')
         expect(scoped.requireString('apiKey')).toBe('secret')
      })

      it('creates dot-notation sub-scope from default container if alias does not exist', () => {
         Config.set('database.host', 'localhost')
         Config.set('database.port', 5432)
         Config.set('database.credentials.user', 'postgres')

         const dbScope = Config.scope('database')
         expect(dbScope.namespace).toBe('@default.database')
         expect(dbScope.requireString('host')).toBe('localhost')
         expect(dbScope.requireNumber('port')).toBe(5432)

         const credsScope = dbScope.scope('credentials')
         expect(credsScope.namespace).toBe('@default.database.credentials')
         expect(credsScope.requireString('user')).toBe('postgres')
      })
   })

   describe('Multi-Source Priority (Memory > Env > Object)', () => {
      it('resolves values according to source priority order', () => {
         const objSource = new ObjectConfigSource(
            {
               title: 'Default Title',
               port: 8080,
               envOnly: 'from-object',
            },
            'low-priority-obj',
            10,
         )

         const envSource = new EnvConfigSource({
            env: {
               PORT: '9000',
               ENV_ONLY: 'from-env',
            },
            priority: 50,
         })

         const container = new ConfigContainer('test-priority', [objSource, envSource])

         // port should come from env (priority 50 > 10)
         expect(container.requireNumber('port')).toBe(9000)

         // title only exists in object (priority 10)
         expect(container.requireString('title')).toBe('Default Title')

         // envOnly exists in both, env takes precedence
         expect(container.requireString('envOnly')).toBe('from-env')

         // In-memory set (priority 100) overrides env and object
         container.set('port', 9999)
         expect(container.requireNumber('port')).toBe(9999)
      })
   })

   describe('EnvConfigSource Mapping', () => {
      it('resolves dot-notation and kebab-case keys to uppercase snake case', () => {
         const envSource = new EnvConfigSource({
            env: {
               DATABASE_URL: 'postgres://localhost:5432/app',
               OAUTH_CLIENT_SECRET: 'secret-xyz',
               DIRECT_KEY: 'direct-val',
            },
         })

         expect(envSource.get('DATABASE_URL')).toBe('postgres://localhost:5432/app')
         expect(envSource.get('database.url')).toBe('postgres://localhost:5432/app')
         expect(envSource.get('oauth.client.secret')).toBe('secret-xyz')
         expect(envSource.get('oauth-client-secret')).toBe('secret-xyz')
         expect(envSource.get('DIRECT_KEY')).toBe('direct-val')
         expect(envSource.get('missing.key')).toBeUndefined()
      })

      it('supports prefix option', () => {
         const envSource = new EnvConfigSource({
            prefix: 'APP_',
            env: {
               APP_PORT: '4321',
               APP_SECRET: 'supersecret',
               OTHER_VAR: 'ignore',
            },
         })

         expect(envSource.get('port')).toBe('4321')
         expect(envSource.get('secret')).toBe('supersecret')
         expect(envSource.get('other.var')).toBeUndefined()

         const all = envSource.getAll()
         expect(all.APP_PORT).toBe('4321')
         expect(all.APP_SECRET).toBe('supersecret')
         expect(all.OTHER_VAR).toBeUndefined()
      })
   })

   describe('ObjectConfigSource & MemoryConfigSource Nested Keys', () => {
      it('resolves deep object paths', () => {
         const objSource = new ObjectConfigSource({
            services: {
               auth: {
                  jwt: {
                     secret: 'jwt-secret-token',
                     expiresIn: 3600,
                  },
               },
            },
         })

         expect(objSource.get('services.auth.jwt.secret')).toBe('jwt-secret-token')
         expect(objSource.get('services.auth.jwt.expiresIn')).toBe(3600)
         expect(objSource.get('services.auth.missing')).toBeUndefined()
         expect(objSource.get('unknown.path')).toBeUndefined()
      })

      it('sets and gets deep paths in MemoryConfigSource', () => {
         const memory = new MemoryConfigSource()
         memory.set('deeply.nested.key', 'hello-nested')

         expect(memory.get('deeply.nested.key')).toBe('hello-nested')
         expect(memory.has('deeply.nested.key')).toBe(true)
         expect(memory.has('deeply.nonexistent')).toBe(false)
      })

      it('registers an AbstractConfigSource directly in addConfig and merges with toRecord', () => {
         const source = new MemoryConfigSource({ 'service.name': 'email', 'service.active': true })
         Config.addConfig('mailer', source)

         const mailer = Config.getConfig('mailer')
         expect(mailer.requireString('service.name')).toBe('email')

         const record = mailer.toRecord()
         expect(record['service.name']).toBe('email')
         expect(record['service.active']).toBe(true)

         const scoped = mailer.scope('service')
         expect(scoped.requireString('name')).toBe('email')
      })

      it('prevents prototype pollution when setting or getting keys across all sources', () => {
         const memory = new MemoryConfigSource()
         memory.set('__proto__.polluted', 'yes')
         memory.set('constructor.prototype.polluted', 'yes')
         memory.set('prototype.polluted', 'yes')

         expect(memory.get('__proto__.polluted')).toBeUndefined()
         expect(memory.get('constructor.prototype.polluted')).toBeUndefined()
         expect(memory.get('prototype.polluted')).toBeUndefined()
         expect(({} as Record<string, unknown>).polluted).toBeUndefined()

         const objSource = new ObjectConfigSource({
            validKey: 'safe',
         })
         expect(objSource.get('__proto__.polluted')).toBeUndefined()
         expect(objSource.get('constructor.prototype.polluted')).toBeUndefined()
         expect(objSource.get('prototype.polluted')).toBeUndefined()

         const container = new ConfigContainer('sec-test')
         container.set('__proto__.injected', 'bad')
         expect(container.get('__proto__.injected')).toBeUndefined()
         expect(({} as Record<string, unknown>).injected).toBeUndefined()
      })

      it('performs deep merge in toRecord() across multiple sources', () => {
         const baseObj = new ObjectConfigSource(
            {
               database: {
                  host: 'localhost',
                  port: 5432,
                  pool: { max: 10, min: 2 },
               },
               app: { name: 'core' },
            },
            'base',
            10,
         )

         const overrideObj = new ObjectConfigSource(
            {
               database: {
                  port: 5433,
                  pool: { max: 20 },
                  user: 'postgres',
               },
            },
            'override',
            20,
         )

         const container = new ConfigContainer('merge-test', [baseObj, overrideObj])
         const collapsed = container.toRecord()

         expect(collapsed).toEqual({
            database: {
               host: 'localhost',
               port: 5433,
               pool: { max: 20, min: 2 },
               user: 'postgres',
            },
            app: { name: 'core' },
         })
      })

      it('falls back to non-prefixed env keys when prefixed key is missing', () => {
         const envSource = new EnvConfigSource({
            prefix: 'APP_',
            env: {
               APP_TITLE: 'My App',
               PORT: '3333',
               HOST_NAME: '0.0.0.0',
            },
         })

         // Prefixed key matches directly
         expect(envSource.get('title')).toBe('My App')
         // Exact raw env key fallback matches
         expect(envSource.get('PORT')).toBe('3333')
         expect(envSource.get('HOST_NAME')).toBe('0.0.0.0')
         expect(envSource.get('missing')).toBeUndefined()
      })

      it('handles trailing dots in scope and retrieves sub-tree in getAll()', () => {
         Config.set('services.mail.smtp.host', 'smtp.example.com')
         Config.set('services.mail.smtp.port', 587)

         const mailScope = Config.scope('services.mail.')
         expect(mailScope.namespace).toBe('@default.services.mail')
         expect(mailScope.requireString('smtp.host')).toBe('smtp.example.com')
         expect(mailScope.requireNumber('smtp.port')).toBe(587)

         const subRecord = mailScope.toRecord()
         expect(subRecord).toEqual({
            smtp: {
               host: 'smtp.example.com',
               port: 587,
            },
         })
      })

      it('safely handles non-primitive types in getters and error messages', () => {
         Config.set('rawObject', { nested: 'data' })
         Config.set('numberAsBool', 1)
         Config.set('zeroAsBool', 0)

         // getString, getNumber, getBoolean should return fallback for objects
         expect(Config.getString('rawObject', 'fallback')).toBe('fallback')
         expect(Config.getNumber('rawObject', 42)).toBe(42)
         expect(Config.getBoolean('rawObject', false)).toBe(false)

         // getBoolean handles numeric 1 and 0
         expect(Config.getBoolean('numberAsBool')).toBe(true)
         expect(Config.getBoolean('zeroAsBool')).toBe(false)

         // Error formatting for requireNumber and requireBoolean with objects
         expect(() => Config.requireNumber('rawObject')).toThrow(
            /Expected numeric value but received \{"nested":"data"\}/,
         )
         expect(() => Config.requireBoolean('rawObject')).toThrow(
            /Expected boolean value \(true\/false\/1\/0\) but received \{"nested":"data"\}/,
         )
      })

      it('handles non-object and array inputs in Config.addConfig gracefully', () => {
         const arrayInput = ['item1', 'item2'] as unknown as Record<string, unknown>
         const container = Config.addConfig('array-test', arrayInput)
         expect(container).toBeInstanceOf(ConfigContainer)
         expect(container.get('item1')).toBeUndefined()
      })
   })
})
