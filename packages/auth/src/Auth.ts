import { Core } from '@quatrain/core'
import { AbstractAuthAdapter } from './AbstractAuthAdapter'
import Middleware from './middlewares/AuthMiddleware'

export enum AuthAction {
   SIGNIN = 'signin',
   SIGNUP = 'signup',
   SIGNOUT = 'signout',
}

/**
 * Authentication Parameters acceptable keys
 */
export type AuthParametersKeys =
   | 'host'
   | 'alias'
   | 'middlewares'
   | 'config'
   | 'fixtures'
   | 'debug'

/**
 * Backend parameters interface
 */
export interface AuthParameters {
   host?: string
   alias?: string
   middlewares?: Middleware[]
   config?: any
   fixtures?: any
   debug?: boolean
}

export interface AuthAdapter extends AbstractAuthAdapter {}

export type AuthRegistry<T extends AbstractAuthAdapter> = { [x: string]: T }

/**
 * Global authentication manager handling registration and retrieval 
 * of diverse Auth providers (adapters) via an alias registry.
 */
export class Auth extends Core {
   /** The fallback provider alias. */
   static defaultProvider = 'default'
   /** Core logger dedicated to Auth actions. */
   static logger = this.addLogger('Auth')


   /** Standardized error message for duplicate email constraint violations. */
   static ERROR_EMAIL_EXISTS = `User email already exists`
   /** Standardized error message for weak password / password complexity violations. */
   static ERROR_WEAK_PASSWORD = `weak_password` // NOSONAR

   protected static _providers: AuthRegistry<any> = {}

   /**
    * Registers a configured auth provider into the global context.
    * 
    * @param provider - Instantiated auth adapter.
    * @param alias - Short identifier name.
    * @param setDefault - If true, marks this adapter as the fallback provider.
    */
   static addProvider(
      provider: AbstractAuthAdapter,
      alias: string,
      setDefault: boolean = false
   ) {
      this._providers[alias] = provider
      if (setDefault) {
         this.defaultProvider = alias
      }
   }

   /**
    * Fetches a registered provider by its alias.
    * 
    * @param alias - Requested provider identifier. Defaults to `defaultProvider`.
    * @returns The corresponding auth adapter.
    * @throws {Error} If the specified alias is unknown.
    */
   static getProvider<T extends AbstractAuthAdapter>(
      alias: string = this.defaultProvider
   ): T {
      if (this._providers[alias]) {
         return this._providers[alias]
      } else {
         throw new Error(`Unknown provider alias: '${alias}'`)
      }
   }

    /**
     * Scans all registered auth providers, collects their endpoint handlers,
     * and registers them dynamically under a common routing root path.
     * 
     * @param server - The Quatrain ServerAdapter (Astro, Express, etc.).
     * @param rootPath - The common authentication root segment (defaults to '/api/auth').
     */
    static registerEndpoints(server: any, rootPath: string = '/api/auth') {
       for (const [alias, provider] of Object.entries(this._providers)) {
          const handler = provider.getEndpointHandler()
          if (handler) {
             this.info(`Registering pluggable API endpoints for auth provider '${alias}' on '${rootPath}/${alias}'`)
             server.addEndpoint(handler, `${rootPath}/${alias}`, { adapter: provider })
          }
       }
    }
}
