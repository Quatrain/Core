import { AbstractRbacMiddleware } from './AbstractRbacMiddleware'
import type { HttpMethod, RbacUserContext } from '../types'

/**
 * Minimal interface representing Astro API/Middleware Context.
 */
export interface AstroLikeContext {
  url: URL
  request: Request
  locals: Record<string, any>
  redirect: (path: string, status?: number) => Response
}

export type AstroLikeMiddlewareNext = () => Promise<Response>

/**
 * Options for configuring AstroRbacMiddleware.
 */
export interface AstroRbacOptions {
  /** Custom extractor function to retrieve the user context from Astro context */
  userResolver?: (context: AstroLikeContext) => Promise<RbacUserContext | null> | RbacUserContext | null
  /** URL path to redirect unauthenticated users for HTML pages (defaults to "/login") */
  loginRedirectPath?: string
  /** URL path to redirect forbidden users for HTML pages (defaults to "/403") */
  forbiddenRedirectPath?: string
  /** Whether to inject tarpit delay asynchronously before proceeding */
  enableTarpitSleep?: boolean
}

/**
 * Astro middleware implementing Quatrain RBAC route guards, FLS context injection and tarpit delays.
 * Unifies API endpoints (JSON responses) and SSR pages (redirects / forbidden status).
 */
export class AstroRbacMiddleware extends AbstractRbacMiddleware<AstroLikeContext, Response> {
  private userResolver?: (context: AstroLikeContext) => Promise<RbacUserContext | null> | RbacUserContext | null
  private loginRedirectPath: string
  private forbiddenRedirectPath: string
  private enableTarpitSleep: boolean

  constructor(engine: any, options: AstroRbacOptions = {}) {
    super(engine)
    this.userResolver = options.userResolver
    this.loginRedirectPath = options.loginRedirectPath || '/login'
    this.forbiddenRedirectPath = options.forbiddenRedirectPath || '/403'
    this.enableTarpitSleep = options.enableTarpitSleep ?? true
  }

  public extractUser(context: AstroLikeContext): Promise<RbacUserContext | null> | RbacUserContext | null {
    if (this.userResolver) {
      return this.userResolver(context)
    }
    return context.locals?.user || null
  }

  public extractRoute(context: AstroLikeContext): { uri: string; method: HttpMethod } {
    return {
      uri: context.url.pathname,
      method: (context.request.method.toUpperCase() as HttpMethod) || 'GET'
    }
  }

  public handleAccessDenied(
    context: AstroLikeContext,
    _res: any,
    reason: 'unauthenticated' | 'forbidden' | 'tarpit_blocked'
  ): Response {
    const isApi = context.url.pathname.startsWith('/api/')

    // 1. API Endpoints return standard JSON responses
    if (isApi) {
      const statusMap = {
        unauthenticated: 401,
        forbidden: 403,
        tarpit_blocked: 429
      }
      const messageMap = {
        unauthenticated: 'Authentication required to access this endpoint.',
        forbidden: 'Forbidden: Insufficient privileges.',
        tarpit_blocked: 'Too Many Requests: Throttled by security tarpit policy.'
      }

      return new Response(
        JSON.stringify({
          error: reason,
          message: messageMap[reason]
        }),
        {
          status: statusMap[reason],
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // 2. SSR HTML Pages return redirects or status pages
    if (reason === 'unauthenticated') {
      const returnUrl = encodeURIComponent(context.url.pathname + context.url.search)
      return context.redirect(`${this.loginRedirectPath}?returnTo=${returnUrl}`)
    }

    return context.redirect(this.forbiddenRedirectPath)
  }

  /**
   * Produces standard Astro middleware handler function.
   */
  public handler() {
    return async (context: AstroLikeContext, next: AstroLikeMiddlewareNext): Promise<Response> => {
      const user = await this.extractUser(context)
      const { uri, method } = this.extractRoute(context)

      // 1. Inject RBAC helper into Astro.locals
      if (!context.locals) {
        context.locals = {}
      }
      context.locals.rbac = this.createRequestContext(user)

      // 2. Evaluate route and tarpit
      const activeUser = user || { id: 'anonymous', roles: ['anonymous'], subjectType: 'human' }
      const evaluation = this.engine.evaluateRoute(activeUser, uri, method)

      // 3. Apply tarpit latency
      if (this.enableTarpitSleep && evaluation.tarpitDelayMs > 0) {
        await this.engine.tarpitManager.sleep(evaluation.tarpitDelayMs)
      }

      // 4. Access Decision
      if (!evaluation.allowed) {
        const reason = evaluation.isThrottled && evaluation.tarpitDelayMs > 0
          ? 'tarpit_blocked'
          : user
            ? 'forbidden'
            : 'unauthenticated'

        return this.handleAccessDenied(context, null, reason)
      }

      const response = await next()

      if (evaluation.tarpitDelayMs > 0 && response?.headers) {
        response.headers.set('X-Security-Tarpit-Delay', `${evaluation.tarpitDelayMs}ms`)
      }

      return response
    }
  }
}
