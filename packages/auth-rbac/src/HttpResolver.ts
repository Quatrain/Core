import { SemanticAction } from '@quatrain/types'

/**
 * Resolves standard HTTP methods to semantic actions.
 * 
 * - GET / HEAD -> 'read'
 * - POST -> 'create' (or 'execute' if matched by an action path convention)
 * - PUT / PATCH -> 'update'
 * - DELETE -> 'delete'
 * - OPTIONS -> 'read'
 */
export function resolveHttpToSemanticAction(
   method: string,
   path: string,
   actionRoutePatterns: RegExp[] = [/\/execute\b/, /\/rotate-secret\b/, /\/oauth\b/, /\/queue\b/, /\/run\b/]
): SemanticAction {
   const upperMethod = method.toUpperCase()

   switch (upperMethod) {
      case 'GET':
      case 'HEAD':
      case 'OPTIONS':
         return 'read'

      case 'POST': {
         // Check if this route is an action/execution rather than an entity creation
         for (const pattern of actionRoutePatterns) {
            if (pattern.test(path)) {
               return 'execute'
            }
         }
         return 'create'
      }

      case 'PUT':
      case 'PATCH':
         return 'update'

      case 'DELETE':
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
