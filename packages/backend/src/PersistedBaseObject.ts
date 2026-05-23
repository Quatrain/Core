import {
   ObjectUri,
   BaseObjectProperties,
   BaseObject,
   BaseObjectType,
   statuses,
} from '@quatrain/core'
import { Query } from './Query'
import { DataObjectClass } from './types/DataObjectClass'
import { PersistedDataObject } from './PersistedDataObject'
import type { BaseRepository } from './BaseRepository'

/**
 * The fundamental class for all domain models that require database persistence.
 * Extends the core `BaseObject` by adding backend-aware lifecycle methods (`save`, `delete`, `query`)
 * and providing a factory to hydrate objects directly from the database.
 */
export class PersistedBaseObject extends BaseObject {
   /** The designated repository class for this model (defaults to BaseRepository). */
   static REPOSITORY_CLASS: any = null
   protected static _repositoryInstance: any = null

   /** The overarching property schema definition inherited and merged from `BaseObject`. */
   static PROPS_DEFINITION: any /*DataObjectProperties*/ = BaseObjectProperties

   protected _dataObject: DataObjectClass<any>

   /**
    * Registers an explicit repository instance for this model class.
    * 
    * @param repoInstance - The repository instance to register.
    */
   static registerRepository(repoInstance: any) {
      this._repositoryInstance = repoInstance
   }

   /**
    * Retrieves the pre-bound repository instance for this model class.
    * Dynamically instantiates the default or customized BaseRepository if not already cached.
    * 
    * @returns The bound BaseRepository instance.
    * @throws {Error} If the default BaseRepository class has not been loaded/configured.
    */
   static repository(): BaseRepository<any> {
      if (!this._repositoryInstance) {
         let RepoClass = this.REPOSITORY_CLASS
         if (!RepoClass) {
            try {
               const resolved = require('./BaseRepository')
               RepoClass = resolved.BaseRepository
            } catch (err) {
               throw new Error(
                  `SecurityError: BaseRepository has not been initialized on PersistedBaseObject.REPOSITORY_CLASS for "${this.name}".`
               )
            }
         }
         this._repositoryInstance = new RepoClass(this)
      }
      return this._repositoryInstance
   }

   constructor(dao: DataObjectClass<any>) {
      super(dao)
      this._dataObject = dao
   }

   /**
    * Looks up a property definition by its name from the merged `PROPS_DEFINITION`.
    * 
    * @param key - The property name.
    * @returns The property definition object if found.
    */
   static getProperty(key: string) {
      return PersistedBaseObject.PROPS_DEFINITION.find(
         (prop: any) => prop.name === key
      )
   }

   /**
    * Merges the parent class property definitions with the child's explicit properties.
    * 
    * @param child - The specific child class.
    * @returns A factory-initialized DataObject representing the merged structure.
    */
   static fillProperties(child: any = this) {
      // merge base properties with additional or redefined ones
      const base = [...PersistedBaseObject.PROPS_DEFINITION]

      child.PROPS_DEFINITION.forEach((property: any) => {
         // manage parent properties potential redeclaration
         const found = base.findIndex((el: any) => el.name === property.name)
         if (found !== -1) {
            base[found] = property
         } else {
            base.push(property)
         }
      })

      const dao = PersistedDataObject.factory({
         properties: base,
         parentProp: this.PARENT_PROP,
      })
      dao.uri.class = child

      return dao
   }

   /**
    * Orchestrates the creation of a DataObject linked to this class schema.
    * Can dynamically read state from the backend if a URI is provided.
    * 
    * @param src - The initialization source (ObjectUri, string path, or existing DAO).
    * @param child - The child class definition.
    * @returns A promise resolving to the fully instantiated DataObject.
    */
   static async daoFactory(
      src: string | ObjectUri | DataObjectClass<any> | undefined = undefined,
      child: any = this
   ): Promise<DataObjectClass<any>> {
      const dao = this.fillProperties(child)

      if (src instanceof ObjectUri) {
         dao.uri = src
         await dao.read()
      } else if (typeof src == 'string') {
         dao.uri.path = src
         await dao.read()
      }

      return dao
   }

   /**
    * Instantiates from an object
    * @param src
    * @param child
    * @returns
    */
   static fromObject<T extends BaseObjectType>(src: T, child: any = this): any {
      const dao = this.fillProperties(child)

      dao.uri = new ObjectUri(
         `${this.COLLECTION}${ObjectUri.DEFAULT}`,
         Reflect.get(src, 'name')
      )

      dao.uri.class = child

      dao.populateFromData(src as any)

      if (dao.has('status') && dao.val('status') === undefined) {
         dao.set('status', statuses.CREATED)
      }

      const obj = new this(dao)

      return obj
   }

   /**
    * Dynamically builds an instance of the class. It can hydrate from a raw data object,
    * an `ObjectUri`, or a backend string path.
    * 
    * @param src - The source data: a string path, an `ObjectUri`, or raw object data.
    * @param child - The specific child class constructor to instantiate.
    * @returns A promise resolving to the fully constructed and hydrated model instance.
    * @throws {Error} If instantiation fails.
    */
   static async factory(
      src: string | ObjectUri | undefined = undefined,
      child: any = this
   ): Promise<any> {
      try {
         if (typeof src == 'object' && !(src instanceof ObjectUri)) {
            return this.fromObject(src)
         }

         if (typeof src === 'string' && !src.includes('/')) {
            src = `${this.COLLECTION}/${src}`
         }

         const dao = await this.daoFactory(src, child)

         if (!src && dao.has('status') && dao.val('status') === undefined) {
            dao.set('status', statuses.CREATED)
         }

         const constructedObject = Reflect.construct(this, [dao])

         return constructedObject
      } catch (err) {
         throw new Error(
            `Unable to build instance for '${this.name}': ${
               (err as Error).message
            }`
         )
      }
   }

   /**
    * Fetches and hydrates an object directly from its backend storage path via the repository facade.
    * 
    * @param path - The backend unique identifier or full URI path (e.g. "users/123" or "123").
    * @returns A promise resolving to the populated class instance.
    */
   static async fromBackend<T>(path: string): Promise<T> {
      return await this.repository().read(path)
   }

   /**
    * Instantiates from a DataObject
    * @param dao
    * @returns
    */
   static fromDataObject<T extends BaseObject>(dao: DataObjectClass<any>): any {
      const obj = new this(dao)

      return obj //.toProxy()
   }

   /**
    * Generates a lightweight Reference representation of the object.
    * Commonly used for NoSQL or object relational mapping.
    * 
    * @returns A standardized object reference.
    */
   asReference() {
      return this._dataObject.toReference()
   }

   /**
    * Creates a chained query for child records originating from the current instance.
    * Used mainly for NoSQL backends to query subcollections seamlessly.
    * 
    * @param obj - The child class definition (e.g., `LogModel`) to query.
    * @returns A new `Query` builder scoped to this parent instance.
    */
   query(obj: any) {
      return new Query(obj, this)
   }

   /**
    * Initializes a static query builder for the current class.
    * 
    * @returns A new `Query` builder scoped to the current collection.
    */
   static query() {
      return new Query(this)
   }

   get dataObject() {
      return this._dataObject
   }

   /**
    * Persists the current state of the object to the configured backend database.
    * Triggers creation or update operations depending on whether the object already exists.
    * 
    * @returns A promise resolving to the instance itself for chaining.
    */
   async save(): Promise<this> {
      const repo = (this.constructor as typeof PersistedBaseObject).repository()
      const saved = this.dataObject.uid
         ? await repo.update(this)
         : await repo.create(this)
      this._dataObject = saved.dataObject
      return this
   }

   /**
    * Deletes the object from the backend database.
    * By default, it performs a soft-delete (modifying the `status` property) unless `hardDelete` is enabled.
    * 
    * @param hardDelete - If true, permanently removes the record from the database.
    * @returns A promise resolving to the underlying `DataObjectClass`.
    */
   async delete(hardDelete = false): Promise<DataObjectClass<any>> {
      const repo = (this.constructor as typeof PersistedBaseObject).repository()
      return await repo.delete(this.dataObject.uid, hardDelete)
   }
}
