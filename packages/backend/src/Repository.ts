import {
   BaseObjectType,
   GoneError,
   NotFoundError,
   ObjectUri,
   statuses,
} from '@quatrain/core'
import { DataObjectClass } from './types/DataObjectClass'
import { PersistedDataObject } from './PersistedDataObject'
import { PersistedBaseObject } from './PersistedBaseObject'
import { Query, QueryResultType } from './Query'
import { BackendInterface } from './types/BackendInterface'
import { Backend, BackendAction } from './Backend'
import { ReferenceType } from './types/ReferenceType'
import { User } from './User'
import type { BaseRepository } from './BaseRepository'

/**
 * A service layer acting as a factory and container for retrieving specific model repositories.
 * Repositories encapsulate complex data access logic beyond basic CRUD operations.
 */
export class Repository {
   /** Registry matching model class names to their corresponding repository file paths (backward compatibility). */
   static matches: { [x: string]: string } = {}

   /** Central static registry matching model classes to their custom repository classes. */
   private static _registry = new Map<any, any>()

   /** The authenticated user currently operating within this repository context. */
   currentUser: User | undefined
   /** Configuration flag indicating whether dates should be formatted. */
   useDateFormat: boolean = true

   /** The persistence adapter backing this repository. */
   backendAdapter: BackendInterface

   constructor(
      backendAdapter: BackendInterface = Backend.getBackend(),
      currentUser: User | undefined = undefined
   ) {
      this.backendAdapter = backendAdapter
      this.currentUser = currentUser
   }

   /**
    * Explicitly registers a custom repository class for a specific model class.
    * 
    * @param model - The model class (extending `PersistedBaseObject`).
    * @param repositoryClass - The custom repository class (extending `BaseRepository`).
    */
   static register(
      model: typeof PersistedBaseObject,
      repositoryClass: any
   ) {
      this._registry.set(model, repositoryClass)
      model.REPOSITORY_CLASS = repositoryClass
   }

   /**
    * Static factory method to resolve and retrieve the repository pre-bound to a model class.
    * 
    * @param model - The model class to get a repository for.
    * @returns The pre-bound repository instance.
    */
   static for<T extends BaseObjectType>(
      model: typeof PersistedBaseObject
   ): BaseRepository<T> {
      return model.repository()
   }

   /**
    * Assigns an authenticated user to this repository context for permission/audit tracking.
    * 
    * @param user - The `User` instance performing the operations.
    */
   setCurrentUser(user: User) {
      this.currentUser = user
   }

   /**
    * Dynamically resolves and instantiates the specific repository class registered for a given model.
    * Incorporates dynamic ESM registry lookups with fallback to BaseRepository.
    * 
    * @param model - The model class (extending `PersistedBaseObject`) to find a repository for.
    * @returns An instantiated repository pre-bound to this context's adapter.
    */
   getFor(model: typeof PersistedBaseObject): any {
      let RepoClass = Repository._registry.get(model) || model.REPOSITORY_CLASS

      if (!RepoClass) {
         const repositoryName = Repository.matches[model.name]
         if (repositoryName) {
            try {
               const resolved = require(repositoryName)
               RepoClass = resolved.default || resolved.UserRepository || resolved[model.name + 'Repository']
            } catch (err) {
               // Dynamic require failed, fallback silently
            }
         }
      }

      if (!RepoClass) {
         try {
            const resolved = require('./BaseRepository')
            RepoClass = resolved.BaseRepository
         } catch (err) {
            throw new Error(`SecurityError: BaseRepository could not be resolved.`)
         }
      }

      return new RepoClass(model, this.backendAdapter)
   }
}
