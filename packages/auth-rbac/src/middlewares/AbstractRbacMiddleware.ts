import { RbacPolicyEngine } from '../engine/RbacPolicyEngine'
import type { RbacUserContext, RbacAction, HttpMethod, RbacRequestContext } from '../types'

/**
 * Abstract base class for framework-specific RBAC middlewares (Express, Astro, etc.).
 * Coordinates route access decisions, user context resolution, FLS helper injection, and tarpitting.
 */
export abstract class AbstractRbacMiddleware<TRequest = any, TResponse = any, TNext = any> {
  constructor(public readonly engine: RbacPolicyEngine) {}

  /**
   * Extracts the authenticated user or M2M agent context from the incoming request.
   *
   * @param request - Native request object.
   * @returns RbacUserContext or null if unauthenticated.
   */
  public abstract extractUser(request: TRequest): Promise<RbacUserContext | null> | RbacUserContext | null

  /**
   * Normalizes the target URI path and HTTP method from the incoming request.
   *
   * @param request - Native request object.
   * @returns Object containing `uri` and `method`.
   */
  public abstract extractRoute(request: TRequest): { uri: string; method: HttpMethod }

  /**
   * Handles access denial according to request context (e.g. JSON error for API, redirect/403 for HTML pages).
   *
   * @param request - Native request object.
   * @param response - Native response object.
   * @param reason - Denial rationale ('unauthenticated' | 'forbidden' | 'tarpit_blocked').
   */
  public abstract handleAccessDenied(
    request: TRequest,
    response: TResponse,
    reason: 'unauthenticated' | 'forbidden' | 'tarpit_blocked'
  ): Promise<any> | any

  /**
   * Factory method building a scoped `RbacRequestContext` helper for controllers and templates.
   *
   * @param user - Current user context (or null for anonymous guest).
   * @returns RbacRequestContext instance.
   */
  public createRequestContext(user: RbacUserContext | null): RbacRequestContext {
    const anonymousUser: RbacUserContext = {
      id: 'anonymous',
      roles: ['anonymous'],
      subjectType: 'human'
    }
    const activeUser = user || anonymousUser

    return {
      user,
      canAccessRoute: (uri: string, action?: RbacAction | HttpMethod) =>
        this.engine.canAccessRoute(activeUser, uri, action),
      getFieldMode: (entity: string, property: string) =>
        this.engine.getFieldAccess(activeUser, entity, property),
      isFieldEditable: (entity: string, property: string) =>
        this.engine.getFieldAccess(activeUser, entity, property) === 'readwrite',
      isFieldVisible: (entity: string, property: string) =>
        this.engine.getFieldAccess(activeUser, entity, property) !== 'hidden',
      sanitizeRead: <T extends Record<string, any>>(entity: string, data: T) =>
        this.engine.sanitizeRead(activeUser, entity, data),
      sanitizeWrite: <T extends Record<string, any>>(entity: string, data: T) =>
        this.engine.sanitizeWrite(activeUser, entity, data)
    }
  }
}
