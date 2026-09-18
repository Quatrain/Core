import {
   SemanticAction,
   PermissionRule,
   RoleDefinition,
   RbacSubject,
   RbacEvaluationResult,
   AuthorizationError,
} from '@quatrain/types'

/**
 * Standard predefined roles available out of the box.
 */
export const StandardRole = {
   ROOT: 'root',
   ADMIN: 'admin',
   PARTNER: 'partner',
   VISITOR: 'visitor',
} as const

export type StandardRoleType = typeof StandardRole[keyof typeof StandardRole]

/**
 * Helper to test wildcard patterns:
 * - '*' matches anything
 * - 'medias/*' matches 'medias/123', 'medias/123/variants'
 * - 'jobs/:id' matches 'jobs/456'
 */
export function matchPattern(pattern: string, target: string): boolean {
   if (pattern === '*' || pattern === target) return true

   // Escape regex special characters except '*' and ':'
   const regexStr = '^' + pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:[a-zA-Z0-9_]+/g, '[^/]+')
      .replace(/\*/g, '.*') + '$'

   const regex = new RegExp(regexStr)
   return regex.test(target)
}

/**
 * Normalizes an action or array of actions into a set of strings.
 */
function normalizeActions(action: SemanticAction | SemanticAction[]): Set<SemanticAction> {
   if (Array.isArray(action)) {
      return new Set(action)
   }
   return new Set([action])
}

/**
 * Tests if a requested action matches a rule's action specification.
 */
function matchAction(ruleAction: SemanticAction | SemanticAction[], requestedAction: SemanticAction): boolean {
   if (requestedAction === '*') return true
   const actions = normalizeActions(ruleAction)
   return actions.has('*') || actions.has(requestedAction)
}

/**
 * Pure, headless, and isomorphic RBAC/ABAC engine.
 * Designed to run without server dependencies in Node.js, Bun, and browser environments.
 */
export class RbacEngine {
   protected roles: Map<string, RoleDefinition> = new Map()

   constructor() {
      this.registerDefaultRoles()
   }

   /**
    * Registers standard default roles (root, visitor).
    * Can be extended or customized by calling registerRole().
    */
   protected registerDefaultRoles(): void {
      // 'root' has unrestricted access to everything
      this.registerRole({
         name: StandardRole.ROOT,
         description: 'Super-administrator with full bypass and wildcard access',
         rules: [
            {
               action: '*',
               resource: '*',
            },
         ],
      })

      // 'visitor' represents unauthenticated or public guest read access
      this.registerRole({
         name: StandardRole.VISITOR,
         description: 'Guest or public access limited to read actions on public resources',
         rules: [
            {
               action: 'read',
               resource: 'public/*',
            },
         ],
      })
   }

   /**
    * Registers or updates a role definition.
    */
   public registerRole(role: RoleDefinition): this {
      this.roles.set(role.name, role)
      return this
   }

   /**
    * Retrieves a role definition by name.
    */
   public getRole(roleName: string): RoleDefinition | undefined {
      return this.roles.get(roleName)
   }

   /**
    * Resolves all rules for a given role name, taking inheritance into account recursively.
    */
   public resolveRoleRules(
      roleName: string,
      visited: Set<string> = new Set()
   ): PermissionRule[] {
      if (visited.has(roleName)) return []
      visited.add(roleName)

      const role = this.roles.get(roleName)
      if (!role) return []

      let rules: PermissionRule[] = [...role.rules]

      if (role.inherits && Array.isArray(role.inherits)) {
         for (const parentRole of role.inherits) {
            rules = rules.concat(this.resolveRoleRules(parentRole, visited))
         }
      }

      return rules
   }

   /**
    * Parses explicit scope strings such as "read:medias/*" or "create:jobs" into a PermissionRule.
    */
   public parseScope(scopeStr: string): PermissionRule | null {
      const parts = scopeStr.split(':')
      if (parts.length < 2) return null

      const action = parts[0].trim() as SemanticAction
      const resource = parts.slice(1).join(':').trim()

      return {
         action,
         resource,
      }
   }

   /**
    * Evaluates whether a subject is allowed to perform a semantic action on a resource.
    */
   public async evaluate<TSubject extends RbacSubject = RbacSubject, TContext = any>(
      subject: TSubject | undefined | null,
      action: SemanticAction,
      resource: string,
      context?: TContext
   ): Promise<RbacEvaluationResult> {
      if (!subject) {
         return {
            allowed: false,
            reason: 'Subject is undefined or null',
         }
      }

      // 1. Root bypass
      if (subject.role === StandardRole.ROOT) {
         return {
            allowed: true,
            reason: 'Root role has full wildcard access',
         }
      }

      // 2. Gather candidate rules from subject's role (including inheritance)
      const roleRules = this.resolveRoleRules(subject.role)

      // 3. Gather candidate rules from subject's explicit scopes (if any)
      const directScopeRules: PermissionRule[] = []
      if (Array.isArray(subject.scopes)) {
         for (const scopeStr of subject.scopes) {
            const parsed = this.parseScope(scopeStr)
            if (parsed) directScopeRules.push(parsed)
         }
      }

      const allRules = [...roleRules, ...directScopeRules]

      // 4. Iterate over rules and check for matches
      for (const rule of allRules) {
         if (matchAction(rule.action, action) && matchPattern(rule.resource, resource)) {
            // Check dynamic condition / scope resolver if present (ABAC)
            if (rule.condition) {
               try {
                  const conditionResult = await rule.condition(subject, context)

                  if (typeof conditionResult === 'boolean') {
                     if (conditionResult) {
                        return {
                           allowed: true,
                           reason: `Allowed by conditional rule on ${rule.resource}`,
                           matchedRule: rule,
                        }
                     }
                  } else if (Array.isArray(conditionResult)) {
                     // Array of allowed identifiers (e.g., company paths)
                     // If context provides targetId or targetCompany, check inclusion
                     const target = (context as any)?.target || (context as any)?.targetCompany || (context as any)?.company
                     if (target && conditionResult.includes(target)) {
                        return {
                           allowed: true,
                           reason: `Allowed by dynamic scope list on ${rule.resource}`,
                           matchedRule: rule,
                        }
                     }
                  }
               } catch (err) {
                  return {
                     allowed: false,
                     reason: `Condition execution threw error: ${(err as Error).message}`,
                     matchedRule: rule,
                  }
               }
            } else {
               return {
                  allowed: true,
                  reason: `Allowed by static rule on ${rule.resource}`,
                  matchedRule: rule,
               }
            }
         }
      }

      return {
         allowed: false,
         reason: `No matching rule allowing action '${action}' on resource '${resource}' for role '${subject.role}'`,
      }
   }

   /**
    * Convenience boolean check: returns true if permitted, false otherwise.
    */
   public async can<TSubject extends RbacSubject = RbacSubject, TContext = any>(
      subject: TSubject | undefined | null,
      action: SemanticAction,
      resource: string,
      context?: TContext
   ): Promise<boolean> {
      const result = await this.evaluate(subject, action, resource, context)
      return result.allowed
   }

   /**
    * Enforces permission: throws AuthorizationError if rejected.
    */
   public async assert<TSubject extends RbacSubject = RbacSubject, TContext = any>(
      subject: TSubject | undefined | null,
      action: SemanticAction,
      resource: string,
      context?: TContext
   ): Promise<void> {
      const result = await this.evaluate(subject, action, resource, context)
      if (!result.allowed) {
         throw new AuthorizationError(result.reason || 'Access denied by RBAC policy')
      }
   }

   /**
    * Privilege Non-Escalation check:
    * Verifies that all requested scopes are a strict subset of the creator/granter's effective permissions.
    * 
    * @param granter The subject creating or updating an entity/token
    * @param requestedScopes The scopes (e.g. ['read:medias/*', 'update:jobs/:id']) to validate
    * @param granterContext Context for evaluating any dynamic condition
    */
   public async isSubsetOf<TSubject extends RbacSubject = RbacSubject, TContext = any>(
      granter: TSubject,
      requestedScopes: string[],
      granterContext?: TContext
   ): Promise<{ valid: boolean; rejectedScopes: string[] }> {
      // Root can grant any scopes
      if (granter.role === StandardRole.ROOT) {
         return { valid: true, rejectedScopes: [] }
      }

      const rejectedScopes: string[] = []

      for (const scopeStr of requestedScopes) {
         const parsed = this.parseScope(scopeStr)
         if (!parsed) {
            rejectedScopes.push(scopeStr)
            continue
         }

         const actionsToCheck = Array.isArray(parsed.action) ? parsed.action : [parsed.action]
         let scopeAllowed = true

         for (const act of actionsToCheck) {
            const evalResult = await this.evaluate(granter, act, parsed.resource, granterContext)
            if (!evalResult.allowed) {
               scopeAllowed = false
               break
            }
         }

         if (!scopeAllowed) {
            rejectedScopes.push(scopeStr)
         }
      }

      return {
         valid: rejectedScopes.length === 0,
         rejectedScopes,
      }
   }
}
