import { BackendInterface } from '../../backends/AbstractAdapter'
import { Query } from '../../backends/Query'
import { BaseObject } from '../BaseObject'
import Payload from './Payload'

export default interface RepositoryClass<T extends BaseObject> {
   backendAdapter: BackendInterface

   /**
    * Creates a given object in the collection and returns it
    * @param obj
    * @returns
    */
   create(obj: T): Promise<T>

   /**
    * Returns an object of the collection from its uid
    * @param uid
    * @returns
    */
   read(uid: string): Promise<T>

   /**
    * Updates a given object in the collction and returns it
    * @param obj
    * @returns
    */
   update(obj: T): Promise<T>

   /**
    * Changes the status of the object to DELETED
    * @param uid
    * @returns
    */
   softDelete(uid: string): Promise<T>

   /**
    * Deletes a given object of the collection
    * @param obj
    */
   hardDelete(uid: string): void

   /**
    * Executes a given query on the collection
    * @param query
    * @returns
    */
   query(query: Query<typeof BaseObject>): Promise<Payload<T>>
}