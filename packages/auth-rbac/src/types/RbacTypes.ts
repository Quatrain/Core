/**
 * Standard HTTP methods supported in route rules.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | '*'

/**
 * Access decision outcome for a route evaluation.
 */
export type AccessDecision = 'allow' | 'deny'

/**
 * Field-level access mode for entity properties.
 * - 'hidden': Property is stripped from read payloads and forbidden in write payloads.
 * - 'readonly': Property is returned in read payloads but cannot be modified in write payloads.
 * - 'readwrite': Property can be freely read and modified.
 */
export type FieldAccessMode = 'hidden' | 'readonly' | 'readwrite'

/**
 * Subject category executing the request.
 * Useful for differentiating human interactions from automated AI agents or M2M services.
 */
export type SubjectType = 'human' | 'agent' | 'service'

/**
 * Rule governing access to a specific URI route pattern and HTTP method.
 */
export interface RouteRule {
  /** Glob-like URI pattern (e.g. "/api/curate/**", "/admin/*", "/**") */
  pattern: string
  /** Targeted HTTP methods. If omitted or containing '*', applies to all methods. */
  methods?: HttpMethod[]
  /** Explicit authorization decision. */
  access: AccessDecision
  /** Optional human-readable rationale or description. */
  description?: string
}

/**
 * Field-level security rules for a specific entity schema.
 */
export interface EntityFieldRules {
  /** Target entity or schema name (e.g. "okf-document", "user", "farm-profile") */
  entity?: string
  /** Default mode applied when a property is not explicitly defined in `fields` */
  defaultMode?: FieldAccessMode
  /** Property-to-mode mapping (e.g. { "soa": "readonly", "internalNotes": "hidden" }) */
  fields: Record<string, FieldAccessMode>
}

/**
 * Role definition encapsulating route rules, entity field security, inheritance and M2M tarpitting.
 */
export interface RoleDefinition {
  /** Unique role identifier (e.g. "reader", "curator", "admin", "ai-agent") */
  id: string
  /** Human-readable role name */
  name: string
  /** Role description and scope */
  description?: string
  /** Inherited role IDs whose permissions are automatically merged */
  inherits?: string[]
  /** Allowed subject types for this role (e.g. ['agent', 'service'] or ['human']) */
  subjectTypes?: SubjectType[]
  /** Route-level access rules */
  routes?: RouteRule[]
  /** Entity field-level security rules */
  entities?: Record<string, EntityFieldRules>
  /** Role-specific rate limiting and tarpitting policy */
  tarpit?: TarpitRuleConfig
}

/**
 * Tarpitting and rate limiting configuration applied to roles or subjects.
 */
export interface TarpitRuleConfig {
  /** Whether tarpitting is active */
  enabled?: boolean
  /** Intentional latency (in milliseconds) injected into suspicious or rate-limited requests */
  delayMs?: number
  /** Maximum allowable requests per sliding minute window */
  maxRequestsPerMinute?: number
  /** Maximum burst capacity before throttling */
  burst?: number
  /** Temporary block duration (in milliseconds) when severe rate violations occur */
  blockDurationMs?: number
}

/**
 * Authenticated user or M2M agent security context passed into the RBAC engine.
 */
export interface RbacUserContext {
  /** Unique user, service account, or agent identifier */
  id: string
  /** Optional email address */
  email?: string
  /** Assigned role identifiers */
  roles: string[]
  /** Subject kind (defaults to 'human' if not specified) */
  subjectType?: SubjectType
  /** Optional fine-grained permission claims */
  permissions?: string[]
  /** Dynamic context attributes (e.g. tenantId, farmId, ipAddress) */
  attributes?: Record<string, any>
}

/**
 * Outcome of evaluating a route request against RBAC policies.
 */
export interface RouteEvaluationResult {
  /** Whether access is granted */
  allowed: boolean
  /** Final decision ('allow' or 'deny') */
  decision: AccessDecision
  /** Matching route rule that determined the outcome, if any */
  matchedRule?: RouteRule
  /** Delay (in ms) to be injected via tarpitting */
  tarpitDelayMs: number
  /** Whether the subject is currently throttled / rate-limited */
  isThrottled: boolean
  /** Human-readable explanation */
  reason?: string
}

/**
 * Scoped helper context exposed to controllers and request handlers.
 */
export interface RbacRequestContext {
  /** Current authenticated user context (null if unauthenticated) */
  user: RbacUserContext | null
  /** Evaluates route permission for a given URI and method */
  canAccessRoute: (uri: string, method?: HttpMethod) => boolean
  /** Returns the calculated field access mode ('hidden' | 'readonly' | 'readwrite') */
  getFieldMode: (entity: string, property: string) => FieldAccessMode
  /** Returns true if the field is editable ('readwrite') */
  isFieldEditable: (entity: string, property: string) => boolean
  /** Returns true if the field is visible (not 'hidden') */
  isFieldVisible: (entity: string, property: string) => boolean
  /** Strips 'hidden' fields from outgoing read payloads */
  sanitizeRead: <T extends Record<string, any>>(entity: string, data: T) => Partial<T>
  /** Strips 'hidden' and 'readonly' fields from incoming write payloads */
  sanitizeWrite: <T extends Record<string, any>>(entity: string, data: T) => Partial<T>
}
