import { ConflictError } from '@quatrain/types'
import { DataObjectClass } from './types/DataObjectClass'

/**
 * Thrown by backend adapters when a write would give two records of a collection the same value
 * for a property declared `unique`.
 */
export class UniqueConstraintError extends ConflictError {
   /** Collection that refused the write. */
   public readonly collection: string
   /** Property whose value is already taken, when the backend reports it. */
   public readonly property?: string

   /**
    * @param collection - Collection that refused the write.
    * @param property - Property whose value is already taken, when known.
    */
   constructor(collection: string, property?: string) {
      super(
         property
            ? `A record of '${collection}' already holds this value for '${property}'`
            : `A record of '${collection}' already holds one of these unique values`
      )
      this.collection = collection
      this.property = property
   }
}

/**
 * Lists the properties of a data object declared `unique`.
 *
 * @param dataObject - Data object whose model is inspected.
 * @returns The property names, as declared in the model.
 */
export function uniquePropertyNames(dataObject: DataObjectClass<any>): string[] {
   return Object.keys(dataObject.properties).filter(
      (name) => dataObject.properties[name]?.unique === true
   )
}
