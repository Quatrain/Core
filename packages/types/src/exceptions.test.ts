import {
   ResourceError,
   BadRequestError,
   UnauthorizedError,
   ForbiddenError,
   NotFoundError,
   GoneError,
   ValidationError
} from './exceptions'

describe('Custom Resource Exceptions', () => {
   it('should instantiate ResourceError with correct name and message', () => {
      const err = new ResourceError('Base error occurred')
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(ResourceError)
      expect(err.message).toBe('Base error occurred')
      expect(err.name).toBe('ResourceError')
   })

   it('should instantiate other derived errors with correct names', () => {
      const badReq = new BadRequestError('Bad Request')
      expect(badReq.name).toBe('BadRequestError')
      expect(badReq.message).toBe('Bad Request')

      const authErr = new UnauthorizedError('Unauthorized')
      expect(authErr.name).toBe('UnauthorizedError')

      const forbidden = new ForbiddenError('Forbidden')
      expect(forbidden.name).toBe('ForbiddenError')

      const notFound = new NotFoundError('Not Found')
      expect(notFound.name).toBe('NotFoundError')

      const gone = new GoneError('Gone')
      expect(gone.name).toBe('GoneError')
   })

   it('should instantiate ValidationError with message and validation errors payload', () => {
      const errs = { email: 'invalid email address', age: 'must be greater than 18' }
      const validationErr = new ValidationError('Validation failed', errs)
      
      expect(validationErr.name).toBe('ValidationError')
      expect(validationErr.message).toBe('Validation failed')
      expect(validationErr.errors).toEqual(errs)

      // Test default parameter
      const emptyValidationErr = new ValidationError('Simple failure')
      expect(emptyValidationErr.errors).toEqual({})
   })
})
