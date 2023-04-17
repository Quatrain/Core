import { AbstractAdapter, BackendInterface } from './'
import { DELETED } from '../statuses'
import { ObjectUri } from '../components/ObjectUri'
import { DataObject } from '../components/DataObject'
import { Core } from '../Core'
import { BackendRecordType } from './AbstractAdapter'
import { Query } from './Query'
import { Filter } from './Filter'
import { Filters } from './Filters'
import { SortAndLimit } from './SortAndLimit'
import { DataObjectClass } from '../components/types/DataObjectClass'
import { BaseObject } from '../components/BaseObject'

export class MockAdapter<T extends BaseObject>
   extends AbstractAdapter
   implements BackendInterface<T>
{
   protected static _fixtures: any = {}

   /**
    * Inject fixtures data to backend adapter
    * Force this backend to be default one
    * @param data BackendRecordType
    */
   static inject(data: BackendRecordType) {
      if (data.uid) {
         MockAdapter._fixtures[data.uid] = data
         Core.defaultBackend = '@mock'
      } else {
         throw new Error(`Can't inject data without uid`)
      }
   }

   static getFixtures() {
      return MockAdapter._fixtures
   }

   static getFixture(key: string) {
      return MockAdapter._fixtures[key]
   }

   create(
      dataObject: DataObjectClass,
      desiredUid: string | undefined = undefined
   ): Promise<DataObjectClass> {
      const uri =
         desiredUid ||
         `${dataObject.uri.class.constructor.name.toLowerCase()}/${Date.now()}`
      MockAdapter.inject({
         ...dataObject.toJSON(),
         uid: uri,
      })
      if (this._params.injectMeta) {
         dataObject.set('createdBy', Core.currentUser)
         dataObject.set('createdAt', Date.now())
      }
      dataObject.uri = new ObjectUri(uri)
      return new Promise(() => dataObject)
   }

   async read(dataObject: DataObjectClass): Promise<DataObjectClass> {
      const path = dataObject.path
      const data = MockAdapter._fixtures[path]

      if (data === undefined) {
         throw new Error(`[Mock] No data for ${path}`)
      }

      console.log(`[DAO] Populating ${path}`)

      return await dataObject.populate(data)
   }

   update(dataObject: DataObjectClass): Promise<DataObjectClass> {
      return new Promise(() => dataObject)
   }

   async delete(dataObject: DataObjectClass): Promise<DataObjectClass> {
      if (this.getParam('softDelete') === true) {
         dataObject.set('status', DELETED)
         MockAdapter.inject({
            ...dataObject.toJSON(),
            uid: dataObject.uid,
         })
      } else if (dataObject.uid !== undefined) {
         delete MockAdapter._fixtures[dataObject.uid]
         dataObject.uri = new ObjectUri()
      }

      return dataObject
   }

   async query(query: Query<any>): Promise<DataObjectClass[]> {
      return this.find(
         await DataObject.factory(query.obj),
         query.filters,
         query.sortAndLimit
      )
   }

   async find(
      dataObject: DataObjectClass,
      filters: Filters | Filter[] | undefined = undefined,
      pagination: SortAndLimit | undefined = undefined
   ): Promise<DataObjectClass[]> {
      console.log('mock', dataObject)
      const result: DataObjectClass[] = []
      for (let key in MockAdapter.getFixtures()) {
         const dao = await dataObject.clone(MockAdapter.getFixture(key))
         result.push(dao)
      }

      return result
   }
}
