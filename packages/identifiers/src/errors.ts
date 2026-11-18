/**
 * Raised when a value is not a well-formed identifier of the expected kind.
 */
export class InvalidIdentifierError extends Error {
   constructor(message: string) {
      super(message)
      this.name = 'InvalidIdentifierError'
   }
}
