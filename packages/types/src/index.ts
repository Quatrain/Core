export { ObjectUri } from './ObjectUri'
export * as statuses from './statuses'
export {
   ResourceError,
   BadRequestError,
   UnauthorizedError,
   ForbiddenError,
   NotFoundError,
   GoneError,
   ValidationError,
   BackendError,
} from './exceptions'

/**
 * Standard properties shared by all persisted base objects.
 */
export interface BaseObjectType {
   /** The name of the resource instance. */
   name: string
   /** Current status indicator (e.g. 'active', 'deleted'). */
   status?: string
   /** Identity referencing the creator of this object. */
   createdBy?: any
   /** Epoch timestamp or string detailing creation date. */
   createdAt?: number | string
   /** Identity referencing the last modifier. */
   updatedBy?: any
   /** Epoch timestamp or string detailing update date. */
   updatedAt?: number | string
   /** Identity referencing the user who deleted this resource. */
   deletedBy?: any
   /** Epoch timestamp or string detailing deletion date. */
   deletedAt?: number | string
}

/**
 * Standard reference mapping structure.
 */
export type ReferenceType = {
   /** The relative path structure of the resource. */
   ref: string
   /** Descriptive display name/label. */
   label?: string
   /** Target database/adapter backend alias. */
   backend?: string
}
