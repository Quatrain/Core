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

export class Repository {
   static matches: { [x: string]: string } = {
      User: '@ttm/users/common/UserRepository.ts',
   }
   currentUser: User | undefined
   useDateFormat: boolean = true

   backendAdapter: BackendInterface

   constructor(
      backendAdapter: BackendInterface = Backend.getBackend(),
      currentUser: User | undefined = undefined
   ) {
      this.backendAdapter = backendAdapter
      this.currentUser = currentUser
   }

   setCurrentUser(user: User) {
      this.currentUser = user
   }

   getFor(model: typeof PersistedBaseObject) {
      const repositoryName = Repository.matches[model.name]

      Backend.info(`Trying to require ${repositoryName}`)
      try {
         const repository = require(repositoryName)
         console.log('repository class', repository)
         if (!repository) {
            throw new Error(`Can't find any repository named: '${repositoryName}'`)
         }
         return new repository.default(model, this.backendAdapter)
      } catch (err) {
         Backend.error(`Can't find any repository named: '${repositoryName}'`)
      }
   }
}
