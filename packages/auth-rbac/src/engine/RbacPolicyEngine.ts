import type {
  RoleDefinition,
  RbacUserContext,
  RbacAction,
  HttpMethod,
  FieldAccessMode,
  RouteRule,
  RouteEvaluationResult,
  SubjectType
} from '../types'
import { mapHttpMethodToAction } from '../types'
import { TarpitManager } from './TarpitManager'

/**
 * Normalizes an action or HTTP method to unified semantic RbacAction.
 */
function normalizeAction(actionOrMethod: string): { semantic: RbacAction; raw: string } {
  const upper = (actionOrMethod || 'READ').toUpperCase()
  if (['READ', 'WRITE', 'CREATE', 'UPDATE', 'DELETE', 'EXECUTE', 'MANAGE', '*'].includes(upper)) {
    return { semantic: upper as RbacAction, raw: upper }
  }
  return { semantic: mapHttpMethodToAction(upper), raw: upper }
}

/**
 * Normalizes an URI string for consistent glob and segment comparison.
 */
function normalizeUri(uri: string): string {
  let clean = uri.trim()
  if (!clean.startsWith('/')) clean = `/${clean}`
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1)
  return clean
}

/**
 * Checks if a path matches a glob pattern (supporting `*` for single segment and `**` for recursive segments).
 */
function matchGlob(pattern: string, uri: string): boolean {
  const normPattern = normalizeUri(pattern)
  const normUri = normalizeUri(uri)

  if (normPattern === '/**' || normPattern === '*') return true
  if (normPattern === normUri) return true

  // Safely translate glob tokens (** and *) to regex
  const regexString =
    '^' +
    normPattern
      .split('**')
      .map((segment) =>
        segment
          .split('*')
          .map((sub) => sub.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&'))
          .join('[^/]+')
      )
      .join('.*') +
    '$'

  const regex = new RegExp(regexString)
  return regex.test(normUri)
}

/**
 * Isomorphic RBAC and Field-Level Security Engine for Quatrain.
 * Manages role hierarchies, route authorizations, payload sanitization, and M2M tarpitting.
 */
export class RbacPolicyEngine {
  private roles: Map<string, RoleDefinition> = new Map()
  /**
   * Dedicated manager handling rate-limiting, anomaly detection, and intentional tarpitting latency.
   */
  public readonly tarpitManager: TarpitManager

  constructor(rolesConfig: RoleDefinition[] = [], tarpitManager?: TarpitManager) {
    rolesConfig.forEach((role) => {
      this.registerRole(role)
    })
    this.tarpitManager = tarpitManager || new TarpitManager()
  }

  /**
   * Registers a new role definition into the engine.
   *
   * @param role - The role definition to add.
   */
  public registerRole(role: RoleDefinition): void {
    this.roles.set(role.id, role)
  }

  /**
   * Resolves the full list of inherited and direct roles for a given set of role IDs.
   *
   * @param roleIds - Assigned role identifiers.
   * @param visited - Cycle detection tracker.
   * @returns Array of all active RoleDefinition instances.
   */
  public resolveRoles(roleIds: string[], visited: Set<string> = new Set()): RoleDefinition[] {
    const resolved: RoleDefinition[] = []

    for (const roleId of roleIds) {
      if (visited.has(roleId)) continue
      visited.add(roleId)

      const role = this.roles.get(roleId)
      if (role) {
        resolved.push(role)
        if (role.inherits && role.inherits.length > 0) {
          const parentRoles = this.resolveRoles(role.inherits, visited)
          resolved.push(...parentRoles)
        }
      }
    }

    return resolved
  }

  /**
   * Filters roles based on subject type compatibility (e.g. human vs agent vs service).
   */
  private getApplicableRoles(user: RbacUserContext): RoleDefinition[] {
    const allRoles = this.resolveRoles(user.roles || [])
    const userSubject: SubjectType = user.subjectType || 'human'

    return allRoles.filter((r) => {
      if (!r.subjectTypes || r.subjectTypes.length === 0) return true
      return r.subjectTypes.includes(userSubject)
    })
  }

  /**
   * Evaluates route access for a user context against a target URI and semantic action (or HTTP method).
   *
   * @param user - Authenticated user context.
   * @param uri - Requested URI path.
   * @param actionOrMethod - Semantic action ('READ', 'WRITE', 'UPDATE', 'DELETE') or HTTP method ("GET", "POST"...).
   * @returns Detailed evaluation result including allow/deny decision and tarpit latency.
   */
  public evaluateRoute(
    user: RbacUserContext,
    uri: string,
    actionOrMethod: RbacAction | HttpMethod | string = 'READ'
  ): RouteEvaluationResult {
    const normUri = normalizeUri(uri)
    const normalized = normalizeAction(actionOrMethod)
    const applicableRoles = this.getApplicableRoles(user)

    // 1. Tarpit Evaluation for M2M Agents and suspicious traffic
    let highestTarpitDelay = 0
    let isThrottled = false

    for (const role of applicableRoles) {
      if (role.tarpit && role.tarpit.enabled !== false) {
        const subjectKey = `${user.subjectType || 'human'}:${user.id}`
        const tarpitRes = this.tarpitManager.evaluate(subjectKey, role.tarpit)
        if (tarpitRes.delayMs > highestTarpitDelay) {
          highestTarpitDelay = tarpitRes.delayMs
        }
        if (tarpitRes.isThrottled) {
          isThrottled = true
        }
        if (tarpitRes.isBlocked) {
          return {
            allowed: false,
            decision: 'deny',
            tarpitDelayMs: highestTarpitDelay,
            isThrottled: true,
            reason: 'Subject is temporarily blocked due to repeated rate limit violations (Tarpit Lock).'
          }
        }
      }
    }

    // 2. Gather all route rules from applicable roles
    const matchingRules: { rule: RouteRule; score: number }[] = []

    for (const role of applicableRoles) {
      if (!role.routes) continue

      for (const rule of role.routes) {
        const declaredActions = rule.actions || rule.methods || []
        const actionMatches =
          declaredActions.length === 0 ||
          declaredActions.includes('*') ||
          declaredActions.includes('MANAGE') ||
          declaredActions.includes(normalized.semantic) ||
          declaredActions.includes(normalized.raw as any) ||
          (normalized.semantic === 'WRITE' && declaredActions.includes('CREATE' as any))

        if (actionMatches && matchGlob(rule.pattern, normUri)) {
          // Specificity score: longer patterns have higher priority
          const score = rule.pattern.replace(/\*/g, '').length
          matchingRules.push({ rule, score })
        }
      }
    }

    // Sort by specificity descending
    matchingRules.sort((a, b) => b.score - a.score)

    if (matchingRules.length > 0) {
      const topMatch = matchingRules[0].rule
      return {
        allowed: topMatch.access === 'allow',
        decision: topMatch.access,
        matchedRule: topMatch,
        tarpitDelayMs: highestTarpitDelay,
        isThrottled
      }
    }

    // Default Deny if no explicit rule matched
    return {
      allowed: false,
      decision: 'deny',
      tarpitDelayMs: highestTarpitDelay,
      isThrottled,
      reason: 'No matching route rule found (Default Deny).'
    }
  }

  /**
   * Fast boolean check for route access.
   */
  public canAccessRoute(
    user: RbacUserContext,
    uri: string,
    actionOrMethod: RbacAction | HttpMethod | string = 'READ'
  ): boolean {
    return this.evaluateRoute(user, uri, actionOrMethod).allowed
  }

  /**
   * Computes the effective Field Access Mode ('hidden' | 'readonly' | 'readwrite')
   * for a specific entity property across all assigned roles.
   *
   * Precedence: 'readwrite' (2) > 'readonly' (1) > 'hidden' (0).
   *
   * @param user - Authenticated user context.
   * @param entity - Entity name (e.g. "okf-document").
   * @param property - Property/field name (e.g. "soa", "internalNotes").
   * @returns FieldAccessMode.
   */
  public getFieldAccess(user: RbacUserContext, entity: string, property: string): FieldAccessMode {
    const applicableRoles = this.getApplicableRoles(user)
    if (applicableRoles.length === 0) return 'hidden'

    let highestRank = -1 // -1: undefined, 0: hidden, 1: readonly, 2: readwrite
    const rankMap: Record<FieldAccessMode, number> = {
      hidden: 0,
      readonly: 1,
      readwrite: 2
    }
    const modeMap: Record<number, FieldAccessMode> = {
      0: 'hidden',
      1: 'readonly',
      2: 'readwrite'
    }

    for (const role of applicableRoles) {
      const entityRules = role.entities?.[entity]
      if (entityRules) {
        const fieldMode = entityRules.fields?.[property] ?? entityRules.defaultMode
        if (fieldMode) {
          const rank = rankMap[fieldMode]
          if (rank > highestRank) {
            highestRank = rank
          }
        }
      }
    }

    return highestRank >= 0 ? modeMap[highestRank] : 'readwrite'
  }

  /**
   * Sanitizes an outgoing read payload by removing all properties marked as 'hidden'.
   *
   * @param user - Authenticated user context.
   * @param entity - Entity name.
   * @param payload - Data object to sanitize.
   * @returns Filtered object.
   */
  public sanitizeRead<T extends Record<string, any>>(
    user: RbacUserContext,
    entity: string,
    payload: T
  ): Partial<T> {
    if (!payload || typeof payload !== 'object') return payload
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(payload)) {
      const mode = this.getFieldAccess(user, entity, key)
      if (mode !== 'hidden') {
        result[key] = value
      }
    }

    return result as Partial<T>
  }

  /**
   * Sanitizes an incoming write payload by stripping any properties marked as 'hidden' or 'readonly'.
   * Only properties explicitly in 'readwrite' mode are preserved.
   *
   * @param user - Authenticated user context.
   * @param entity - Entity name.
   * @param payload - Incoming update data.
   * @returns Safe object containing only writable fields.
   */
  public sanitizeWrite<T extends Record<string, any>>(
    user: RbacUserContext,
    entity: string,
    payload: T
  ): Partial<T> {
    if (!payload || typeof payload !== 'object') return payload
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(payload)) {
      const mode = this.getFieldAccess(user, entity, key)
      if (mode === 'readwrite') {
        result[key] = value
      }
    }

    return result as Partial<T>
  }

  /**
   * Generic sanitization helper for either 'read' or 'write' operations.
   */
  public sanitizePayload<T extends Record<string, any>>(
    user: RbacUserContext,
    entity: string,
    payload: T,
    operation: 'read' | 'write'
  ): Partial<T> {
    return operation === 'read'
      ? this.sanitizeRead(user, entity, payload)
      : this.sanitizeWrite(user, entity, payload)
  }
}
