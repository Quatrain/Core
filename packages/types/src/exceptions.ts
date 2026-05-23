/**
 * Global abstraction identifying Quatrain-specific execution exceptions.
 */
export class ResourceError extends Error {
   constructor(message: string) {
      super(message)
      this.name = this.constructor.name
   }
}

/** Indicates a structurally flawed request (e.g., HTTP 400). */
export class BadRequestError extends ResourceError {}

/** Indicates missing or invalid authentication credentials (e.g., HTTP 401). */
export class UnauthorizedError extends ResourceError {}

/** Indicates an authenticated action denied by privileges (e.g., HTTP 403). */
export class ForbiddenError extends ResourceError {}

/** Indicates a non-existent database or file resource lookup (e.g., HTTP 404). */
export class NotFoundError extends ResourceError {}

/** Indicates an originally valid asset that has been purged (e.g., HTTP 410). */
export class GoneError extends ResourceError {}

/**
 * Indicates property rejection. Holds a payload of granular property-specific validation issues.
 */
export class ValidationError extends ResourceError {
   /** Detailed key-value map linking property names to specific violation causes. */
   public errors: Record<string, string>

   constructor(message: string, errors: Record<string, string> = {}) {
      super(message)
      this.errors = errors
   }
}
