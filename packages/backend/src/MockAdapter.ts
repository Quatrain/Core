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

   static getFixtures(): any[] {
      return MockAdapter._fixtures
   }

   static getFixture(key: string): any {
      return MockAdapter._fixtures[key]
   }

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

   async read(dataObject: DataObjectClass<any>): Promise<DataObjectClass<any>> {
      return new Promise(async (resolve, reject) => {
         const path = dataObject.path
         const data = MockAdapter._fixtures[path]

         if (data === undefined) {
            reject(new NotFoundError(`[Mock] No data for ${path}`))
            return
         }

         this.log(`[DAO] Populating ${dataObject.path}`)
         resolve(await dataObject.populate(data))
      })
   }

   async update(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>> {
      return new Promise(async (resolve, reject) => {
         const path = dataObject.path
         const data = MockAdapter._fixtures[path]

         if (data === undefined) {
            reject(new NotFoundError(`[Mock] No data for ${path}`))
         }
         this.log(`[DAO] Updating ${dataObject.path}`)
         MockAdapter._fixtures[path] = { ...data, ...dataObject.toJSON() }
         resolve(dataObject)
      })
   }

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
                           if (
                              filter.value instanceof ObjectUri &&
                              val &&
                              val.ref !== filter.value.path
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

   generateCreateSql(collection: string, properties: any[]): { upSql: string, downSql: string } {
      return { upSql: '', downSql: '' }
   }

   generateDeltaSql(collection: string, delta: any): { upSql: string[], downSql: string[] } {
      return { upSql: [], downSql: [] }
   }
}
