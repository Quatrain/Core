import { DataObjectClass } from './DataObjectClass'
import { Filter } from '../Filter'
import { Filters } from '../Filters'
import { Query, QueryResultType } from '../Query'
import { SortAndLimit } from '../SortAndLimit'
import { SchemaDelta } from './SchemaDelta'

export interface BackendInterface {
   create(
      dataObject: DataObjectClass<any>,
      desiredUid: string | undefined
   ): Promise<DataObjectClass<any>>

   read(param: string | DataObjectClass<any>): Promise<DataObjectClass<any>>

   update(dataObject: DataObjectClass<any>): Promise<DataObjectClass<any>>

   delete(
      dataObject: DataObjectClass<any>,
      hardDelete?: boolean
   ): Promise<DataObjectClass<any>>

   query(query: Query<any>): Promise<QueryResultType<DataObjectClass<any>>>

   find(
      dataObject: DataObjectClass<any>,
      filters: Filters | Filter[] | undefined,
      pagination: SortAndLimit | undefined,
      parent: any
   ): Promise<QueryResultType<DataObjectClass<any>>>

   generateCreateSql(collection: string, properties: any[]): { upSql: string, downSql: string }
   generateDeltaSql(collection: string, delta: SchemaDelta): { upSql: string[], downSql: string[] }
}
