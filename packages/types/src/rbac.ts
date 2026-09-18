/**
 * Semantic actions applicable to resources, compatible with Quatrain backend operations.
 */
export type SemanticAction =
   | 'create'
   | 'read'
   | 'update'
   | 'delete'
   | 'execute'
   | '*'

/**
 * Standard identity representation of a subject (user, application token, worker, system)
 * subjected to RBAC evaluation.
 */
export interface RbacSubject {
   /** Unique identifier of the subject. */
   uid: string
   /** Role assigned to the subject (e.g., 'root', 'admin', 'partner', 'visitor'). */
   role: string
   /** Company or tenant reference associated with the subject. */
   company?: any
   /** Optional scopes or granular permission rules directly attached to the subject. */
   scopes?: string[]
   /** Extensible attributes for dynamic ABAC condition checking. */
   [key: string]: any
}

/**
 * Dynamic condition evaluator or scope resolver attached to a permission rule or role.
 * Can return:
 * - boolean: whether access is granted in the given context
 * - string[]: an array of allowed scope identifiers (e.g., company paths)
 */
export type DynamicScopeResolver<
   TSubject extends RbacSubject = RbacSubject,
   TContext = any,
> = (
   subject: TSubject,
   context?: TContext
) => Promise<boolean | string[]> | boolean | string[]

/**
 * Granular permission rule definition.
 */
export interface PermissionRule<
   TSubject extends RbacSubject = RbacSubject,
   TContext = any,
> {
   /**
    * Effect of the rule: 'allow' (default) or 'deny' (antimatch to explicitly prohibit).
    */
   effect?: 'allow' | 'deny'
   /** Semantic action or actions covered by this rule. */
   action: SemanticAction | SemanticAction[]
   /** Target resource identifier, pattern, or path (supports '*' wildcards and ':param' segments). */
   resource: string
   /** Optional dynamic condition evaluator for attribute-based checks. */
   condition?: DynamicScopeResolver<TSubject, TContext>
}

/**
 * Role definition aggregating multiple permission rules and inheritance.
 */
export interface RoleDefinition<
   TSubject extends RbacSubject = RbacSubject,
   TContext = any,
> {
   /** Unique role name (e.g. 'root', 'admin', 'partner', 'visitor'). */
   name: string
   /** Optional human-readable description of the role's purpose. */
   description?: string
   /** Optional array of role names from which this role inherits permissions. */
   inherits?: string[]
   /** Set of permission rules granted by this role. */
   rules: PermissionRule<TSubject, TContext>[]
}

/**
 * Result of an RBAC evaluation.
 */
export interface RbacEvaluationResult {
   /** Whether the action on the resource is allowed. */
   allowed: boolean
   /** Reason or explanation for the decision, useful for auditing or debugging. */
   reason?: string
   /** The specific matched rule, if access was granted or explicitly denied. */
   matchedRule?: PermissionRule
}
