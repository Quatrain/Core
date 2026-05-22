import { Core, ObjectUri } from '@quatrain/core'
import { DataObjectClass } from './types/DataObjectClass'
import { faker } from '@faker-js/faker'
import { BackendError } from './BackendError'
import { NotFoundError } from './NotFoundError'
import { QueryResultType } from './Query'
import { Filter } from './Filter'
import { Filters } from './Filters'
import { SortAndLimit } from './SortAndLimit'
import { AbstractBackendAdapter } from './AbstractBackendAdapter'
import { BackendInterface } from './types/BackendInterface'
import { BackendRecordType } from './Backend'

/**
 * In-memory mock adapter used strictly for testing and validation.
 * Intercepts database calls and reads/writes to a static local fixture dictionary.
 * Does not support SQL operations.
 */
export class MockAdapter
   extends AbstractBackendAdapter
   implements BackendInterface
{
   protected static _fixtures: any = {}

   /**
    * Inject fixtures data to backend adapter
    * @param data BackendRecordType
    */
   static inject(data: BackendRecordType) {
      if (data.path) {
         MockAdapter._fixtures[data.path] = this.dao2backend(data)
      } else {
         throw new Error(`Can't inject data without a path`)
      }
   }

   /**
    * Helper translating DataObjects references to backend string URIs.
    * 
    * @param data - The Backend record footprint.
    * @returns A promise resolving to the processed object.
    */
   static dao2backend(data: BackendRecordType): Promise<any> {
      const processed: any = {}
      Object.keys(data).forEach((key: any) => {
         if (
            data[key] !== null &&
            typeof data[key] === 'object' &&
            data[key].name === 'BaseObject'
         ) {
            processed[key] = data[key].dataObject.uri.toReference()
         } else {
            processed[key] = data[key]
         }
      })
      return processed
   }

   /**
    * Returns the complete dictionary of injected fixtures.
    * 
    * @returns The fixture store object.
    */
   static getFixtures(): any[] {
      return MockAdapter._fixtures
   }

   /**
    * Retrieves a single fixture by its collection URI.
    * 
    * @param key - The URI key.
    * @returns The raw object fixture.
    */
   static getFixture(key: string): any {
      return MockAdapter._fixtures[key]
   }

   /**
    * Mocks the `create` database action, storing the item in the local fixture map.
    * Generates a random alphanumeric ID via faker.
    * 
    * @param dataObject - The DataObject to save.
    * @returns A promise resolving to the DataObject populated with the new URI.
    */
   create(dataObject: DataObjectClass<any>): Promise<DataObjectClass<any>> {
      const uri = `${this.getCollection(
         dataObject
      )}/${faker.random.alphaNumeric(12)}`

      dataObject.uri = new ObjectUri(uri)

      return new Promise((resolve, reject) => {
         try {
            MockAdapter.inject({
               ...dataObject.toJSON(),
               uid: uri,
               path: uri,
            })
            resolve(dataObject)
         } catch (err) {
            reject(new BackendError((err as Error).message))
         }
      })
   }

   /**
    * Mocks the `read` action by looking up the URI in the local fixtures.
    * 
    * @param dataObject - The unpopulated DataObject with a target URI.
    * @returns A promise resolving to the hydrated DataObject.
    * @throws {NotFoundError} If the fixture isn't found.
    */
   async read(dataObject: DataObjectClass<any>): Promise<DataObjectClass<any>> {
      const path = dataObject.path
      const data = MockAdapter._fixtures[path]

      if (data === undefined) {
         throw new NotFoundError(`[Mock] No data for ${path}`)
      }

      this.log(`[DAO] Populating ${dataObject.path}`)
      return await dataObject.populate(data)
   }

   /**
    * Mocks the `update` action by merging the new state into the static fixture dictionary.
    * 
    * @param dataObject - The mutated DataObject.
    * @returns A promise resolving to the DataObject.
    * @throws {NotFoundError} If the target doesn't exist.
    */
   async update(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>> {
      const path = dataObject.path
      const data = MockAdapter._fixtures[path]

      if (data === undefined) {
         throw new NotFoundError(`[Mock] No data for ${path}`)
      }
      this.log(`[DAO] Updating ${dataObject.path}`)
      MockAdapter._fixtures[path] = { ...data, ...dataObject.toJSON() }
      return dataObject
   }

   /**
    * Mocks the `delete` action by removing the key from the static fixture map.
    * 
    * @param dataObject - The target DataObject.
    * @returns A promise resolving to the cleared DataObject.
    */
   async delete(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>> {
      return new Promise((resolve, reject) => {
         const path = dataObject.path
         const data = MockAdapter._fixtures[path]

         if (data === undefined) {
            reject(new NotFoundError(`[Mock] No data for ${path}`))
         }

         delete MockAdapter._fixtures[dataObject.path]
         dataObject.uri = new ObjectUri()

         resolve(dataObject)
      })
   }

   /**
    * Mocks the `deleteCollection` action by looping through all fixtures and deleting matches.
    * 
    * @param collection - The collection name prefix.
    * @param batchSize - Unused in Mock adapter.
    * @returns A promise resolving on completion.
    */
   async deleteCollection(
      collection: string,
      batchSize?: number | undefined
   ): Promise<void> {
      for (let key in MockAdapter._fixtures) {
         if (key.startsWith(`${collection}/`)) {
            delete MockAdapter._fixtures[key]
         }
      }
      return new Promise(() => null)
   }

   /**
    * Mocks the `find` action by executing manual object comparison over the local fixtures array.
    * 
    * @param dataObject - The query context target.
    * @param filters - Iterated list of filters.
    * @param pagination - Extracted sorting/limit conditions.
    * @returns A promise resolving to the found items array and metadata.
    */
   async find(
      dataObject: DataObjectClass<any>,
      filters: Filters | Filter[] | undefined = undefined,
      pagination: SortAndLimit | undefined = undefined
   ): Promise<QueryResultType<DataObjectClass<any>>> {
      const limit = pagination?.limits.batch || 1e10
      let items: DataObjectClass<any>[] = []
      const collection = this.getCollection(dataObject)
      // TODO filter only records matchinf collection
      for (let key in MockAdapter.getFixtures()) {
         let keep = true
         if (key.startsWith(`${collection}/`) && items.length <= limit) {
            const dao = await dataObject.clone(MockAdapter.getFixture(key))

            if (filters) {
               if (Array.isArray(filters)) {
                  filters.forEach((filter) => {
                     const prop = dao.get(filter.prop)

                     if (typeof prop === 'undefined') {
                        keep = false
                        return
                     }

                     const val = prop.val()

                     if (typeof prop === 'object') {
                        if (prop.constructor.name === 'ObjectProperty') {
                           const valPath = val instanceof ObjectUri ? val.path : (val && typeof val === 'object' ? (val as any).ref : val);
                           if (
                              filter.value instanceof ObjectUri &&
                              valPath &&
                              valPath !== filter.value.path
                           ) {
                              keep = false
                              return
                           }
                        } else if (
                           prop.constructor.name === 'CollectionProperty'
                        ) {
                           if (
                              filter.value instanceof ObjectUri &&
                              prop.val() !== filter.value.path
                           ) {
                              keep = false
                              return
                           }
                        } else if (val !== filter.value) {
                           keep = false
                           return
                        }
                     } else {
                        if ((prop as any).val() !== filter.value) {
                           keep = false
                           return
                        }
                     }
                  })
               }
            }

            if (keep) {
               dao.uri = new ObjectUri(key)
               items.push(dao)
            }
         }
      }

      if (pagination && pagination.sortings.length > 0) {
         items = items.sort(
            (a: DataObjectClass<any>, b: DataObjectClass<any>) =>
               Number(
                  a.val(pagination.sortings[0].prop) >
                     b.val(pagination.sortings[0].prop)
               )
         )
      }

      return {
         items,
         meta: {
            count: 100,
            offset: pagination?.limits.offset || 0,
            batch: pagination?.limits.batch || 10,
            executionTime: Core.timestamp(),
         },
      }
   }

   /**
    * Unsupported stub for creating tables.
    * @returns Empty strings.
    */
   generateCreateSql(collection: string, properties: any[]): { upSql: string, downSql: string } {
      return { upSql: '', downSql: '' }
   }

   /**
    * Unsupported stub for altering schemas.
    * @returns Empty arrays.
    */
   generateDeltaSql(collection: string, delta: any): { upSql: string[], downSql: string[] } {
      return { upSql: [], downSql: [] }
   }
}
