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

export interface BaseObjectType {
   name: string
   status?: string
   createdBy?: any
   createdAt?: number | string
   updatedBy?: any
   updatedAt?: number | string
   deletedBy?: any
   deletedAt?: number | string
}

export type ReferenceType = {
   ref: string
   label?: string
   backend?: string
}
