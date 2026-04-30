export class ResourceError extends Error {
   constructor(message: string) {
      super(message)

      this.name = this.constructor.name
   }
}

export class BadRequestError extends ResourceError {}

export class UnauthorizedError extends ResourceError {}

export class ForbiddenError extends ResourceError {}

export class NotFoundError extends ResourceError {}

export class GoneError extends ResourceError {}

export class ValidationError extends ResourceError {
   public errors: Record<string, string>

   constructor(message: string, errors: Record<string, string> = {}) {
      super(message)
      this.errors = errors
   }
}
