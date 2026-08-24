import { AbstractRbacMiddleware } from './AbstractRbacMiddleware'
import type { HttpMethod, RbacUserContext } from '../types'

/**
 * Minimal interface representing Express-like Request.
 */
export interface ExpressLikeRequest {
  path: string
  url?: string
  method: string
  user?: RbacUserContext
  auth?: { user?: RbacUserContext }
  rbac?: any
  headers?: Record<string, string | string[] | undefined>
  ip?: string
  socket?: { remoteAddress?: string }
}

/**
 * Minimal interface representing Express-like Response.
 */
export interface ExpressLikeResponse {
  statusCode?: number
  status: (code: number) => this
  json: (body: any) => this
  setHeader?: (name: string, value: string) => this
}

export type ExpressLikeNextFunction = (err?: any) => void

/**
 * Options for configuring ExpressRbacMiddleware.
 */
export interface ExpressRbacOptions {
  /** Custom extractor function to retrieve the user context from request */
  userResolver?: (req: ExpressLikeRequest) => Promise<RbacUserContext | null> | RbacUserContext | null
  /** Whether to inject tarpit delay asynchronously before calling next() */
  enableTarpitSleep?: boolean
}

/**
 * Express middleware implementing Quatrain RBAC route guards, FLS context injection and tarpit delays.
 */
export class ExpressRbacMiddleware extends AbstractRbacMiddleware<
  ExpressLikeRequest,
  ExpressLikeResponse,
  ExpressLikeNextFunction
> {
  private userResolver?: (req: ExpressLikeRequest) => Promise<RbacUserContext | null> | RbacUserContext | null
  private enableTarpitSleep: boolean

  constructor(engine: any, options: ExpressRbacOptions = {}) {
    super(engine)
    this.userResolver = options.userResolver
    this.enableTarpitSleep = options.enableTarpitSleep ?? true
  }

  public extractUser(req: ExpressLikeRequest): Promise<RbacUserContext | null> | RbacUserContext | null {
    if (this.userResolver) {
      return this.userResolver(req)
    }
    return req.user || req.auth?.user || null
  }

  public extractRoute(req: ExpressLikeRequest): { uri: string; method: HttpMethod } {
    return {
      uri: req.path || req.url || '/',
      method: ((req.method || 'GET').toUpperCase() as HttpMethod) || 'GET'
    }
  }

  public handleAccessDenied(
    _req: ExpressLikeRequest,
    res: ExpressLikeResponse,
    reason: 'unauthenticated' | 'forbidden' | 'tarpit_blocked'
  ) {
    if (reason === 'unauthenticated') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required to access this resource.'
      })
    }
    if (reason === 'tarpit_blocked') {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Access temporarily throttled or blocked by security tarpit policy.'
      })
    }
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient privileges to access this endpoint.'
    })
  }

  /**
   * Generates standard Express middleware handler function.
   */
  public handler() {
    return async (req: ExpressLikeRequest, res: ExpressLikeResponse, next: ExpressLikeNextFunction) => {
      try {
        const user = await this.extractUser(req)
        const { uri, method } = this.extractRoute(req)

        // 1. Inject RBAC request helper
        req.rbac = this.createRequestContext(user)

        // 2. Evaluate route and tarpitting policy
        const activeUser = user || { id: 'anonymous', roles: ['anonymous'], subjectType: 'human' }
        const evaluation = this.engine.evaluateRoute(activeUser, uri, method)

        // 3. Apply tarpit latency if required (slows down bots and rapid scanners)
        if (this.enableTarpitSleep && evaluation.tarpitDelayMs > 0) {
          await this.engine.tarpitManager.sleep(evaluation.tarpitDelayMs)
        }

        if (res.setHeader && evaluation.tarpitDelayMs > 0) {
          res.setHeader('X-Security-Tarpit-Delay', `${evaluation.tarpitDelayMs}ms`)
        }

        // 4. Access Decision
        if (!evaluation.allowed) {
          const reason = evaluation.isThrottled && evaluation.tarpitDelayMs > 0
            ? 'tarpit_blocked'
            : user
              ? 'forbidden'
              : 'unauthenticated'

          return this.handleAccessDenied(req, res, reason)
        }

        return next()
      } catch (err) {
        return next(err)
      }
    }
  }
}
