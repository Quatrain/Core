import { SemanticAction } from '@quatrain/types'
import { HttpMethod } from '@quatrain/http'

/**
 * Resolves standard HTTP methods to semantic actions.
 * 
 * - GET / HEAD / OPTIONS -> 'read'
 * - POST -> 'create' (or 'execute' if matched by an action path convention)
 * - PUT / PATCH -> 'update'
 * - DELETE -> 'delete'
 */
export function resolveHttpToSemanticAction(
   method: HttpMethod | string,
   path: string,
   actionRoutePatterns: RegExp[] = [/\/execute\b/, /\/rotate-secret\b/, /\/oauth\b/, /\/queue\b/, /\/run\b/]
): SemanticAction {
   const upperMethod = typeof method === 'string' ? method.toUpperCase() : method

   switch (upperMethod) {
      case HttpMethod.GET:
      case HttpMethod.HEAD:
      case HttpMethod.OPTIONS:
         return 'read'

      case HttpMethod.POST: {
         // Check if this route is an action/execution rather than an entity creation
         for (const pattern of actionRoutePatterns) {
            if (pattern.test(path)) {
               return 'execute'
            }
         }
         return 'create'
      }

      case HttpMethod.PUT:
      case HttpMethod.PATCH:
         return 'update'

      case HttpMethod.DELETE:
         return 'delete'

      default:
         return '*'
   }
}

/**
 * Strips prefix (e.g. '/api/v1/') and sanitizes path for clean resource matching.
 */
export function sanitizeResourcePath(path: string, prefixToRemove: string = '/api/'): string {
   let sanitized = path.split('?')[0] // remove query string
   if (prefixToRemove && sanitized.startsWith(prefixToRemove)) {
      sanitized = sanitized.slice(prefixToRemove.length)
   }
   // Remove leading slash
   if (sanitized.startsWith('/')) {
      sanitized = sanitized.slice(1)
   }
   return sanitized
}
