import { NotFoundError as CoreNotFoundError } from '@quatrain/core'

/**
 * Standard exception thrown by Backend Adapters when a specific record URI cannot be located.
 */
export class NotFoundError extends CoreNotFoundError {}

