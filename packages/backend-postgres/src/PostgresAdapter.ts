import {
   ObjectUri,
   NotFoundError,
   statuses,
   StringProperty,
   Core,
} from '@quatrain/core'
import {
   DataObjectClass,
   Backend,
   AbstractBackendAdapter,
   BackendAction,
   BackendParameters,
   BackendError,
   QueryMetaType,
   QueryResultType,
   Filters,
   Filter,
   SortAndLimit,
   Sorting,
   CollectionHierarchy,
} from '@quatrain/backend'
import { randomUUID } from 'node:crypto'
import { Pool, PoolClient, PoolConfig, types } from 'pg'

// PostgreSQL type OIDs for timestamp types
const TIMESTAMP_OID = 1114 // timestamp without time zone
const TIMESTAMPTZ_OID = 1184 // timestamp with time zone

// Configure pg to return timestamps as UTC strings instead of Date objects
// This prevents the driver from interpreting timestamps in the server's local timezone
types.setTypeParser(TIMESTAMP_OID, (val: string) => {
   // Treat TIMESTAMP WITHOUT TIME ZONE as UTC by appending 'Z'
   return val ? val.replace(' ', 'T') + 'Z' : val
})
types.setTypeParser(TIMESTAMPTZ_OID, (val: string) => {
   // TIMESTAMPTZ already has timezone info, just normalize format
   return val ? val.replace(' ', 'T') : val
})

const operatorsMap: { [x: string]: string } = {
   equals: '=',
   notEquals: '!=',
   greater: '>',
   greaterOrEquals: '>=',
   lower: '<',
   lowerOrEquals: '<=',
   like: 'ILIKE',
   contains: 'in',
   notContains: 'not in',
   containsAll: '<@',
   containsAny: '&&',
   isNull: 'IS NULL',
   isNotNull: 'IS NOT NULL',
}

/**
 * Backend adapter implementation for PostgreSQL databases.
 * Translates Quatrain's DataObjects and Queries into raw SQL queries using the `pg` client.
 * Supports relational schema mapping, JSONB arrays, and advanced filtering.
 * 
 * https://en.wikipedia.org/wiki/List_of_SQL_reserved_words
 */
export class PostgresAdapter extends AbstractBackendAdapter {
   protected _connection: undefined | PoolClient
   protected _pool: undefined | Pool

   constructor(params: BackendParameters = {}) {
      super(params)
   }

   protected _buildPath(dataObject: DataObjectClass<any>, uid?: string) {
      const collection = this.getCollection(dataObject)
      if (!collection) {
         throw new BackendError(
            `[PGA] Can't define record path without a collection name`
         )
      }

      // define document path
      let path = `${collection}/${uid}`
      if (
         this._params.hierarchy &&
         this._params.hierarchy[collection] ===
            CollectionHierarchy.SUBCOLLECTION &&
         dataObject.parentProp &&
         dataObject.has(dataObject.parentProp) &&
         dataObject.val(dataObject.parentProp)
      ) {
         path = `${dataObject.val(dataObject.parentProp).path}/${path}`
      }

      Backend.debug(`[PGA] Record path is '${path}'`)

      return path
   }
   protected async _connect(): Promise<PoolClient> {
      if (!this._pool) {
         const {
            user = '',
            password = '',
            host = 'localhost',
            port = 6543,
            database = 'postgres',
            max = 20, // Lower per-process default
         }: PoolConfig = this._params.config
         Backend.info(
            `Creating Postgres Pool on postgresql://${host}:${port}/${database} (max: ${max})`
         )
         this._pool = new Pool({
            host,
            port,
            database,
            user,
            password,
            max,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 3000,
         })
      }

      return await this._pool.connect()
   }

   protected async _query(sql: string, params: any[] = []) {
      const connection = await this._connect()
      try {
         return await connection.query(sql, params)
      } finally {
         connection.release()
      }
   }

   /**
    * Executes an arbitrary raw SQL query against the Postgres database.
    * 
    * @param sql - The SQL statement with optional $1, $2 parameterized placeholders.
    * @param params - The array of parameter values to inject into the query.
    * @returns A promise resolving to the pg `QueryResult`.
    */
   async rawQuery(sql: string, params?: any[]): Promise<any> {
      return this._query(sql, params)
   }

   /**
    * Disconnect the pool and close all idle connections.
    */
   async disconnect() {
      if (this._pool) {
         Backend.info('[PGA] Shutting down Postgres connection pool...')
         await this._pool.end()
         this._pool = undefined
         Backend.info('[PGA] Connection pool has been shut down.')
      }
   }

   /**
    * Process data for compatibility
    * @param data
    * @param filterNulls
    * @returns
    */
   protected _prepareData(data: any, filterNulls = true) {
      if (filterNulls) {
         data = Object.values(data).filter((v) => v !== null)
      } else {
         data = Object.values(data)
      }

      if (
         this._params['useNativeForeignKeys'] &&
         this._params['useNativeForeignKeys'] === true
      ) {
         data.forEach((el: any, key: number) => {
            if (
               typeof el === 'object' &&
               el !== null &&
               Reflect.has(el, 'ref')
            ) {
               const resourcePart = el.ref.split('/').pop()
               if (resourcePart.indexOf('.') === -1) {
                  // convert reference for database objects only
                  data[key] = el.ref.split('/').pop()
               }
            }
         })
      }

      return data
   }

   /**
    * Resolves the table/collection name for a given model or relation reference.
    * Accounts for mapping definitions, class constructors, or raw string types.
    * 
    * @param instanceOf - The relation constructor, class, or collection name string.
    * @returns The resolved table/collection name.
    */
   protected _resolveTable(instanceOf: any): string {
      if (!instanceOf) {
         return ''
      }
      if (this._params.mapping && this._params.mapping[instanceOf]) {
         return this._params.mapping[instanceOf]
      }
      if (typeof instanceOf === 'string') {
         const resolvedClass = Core.getClass(instanceOf)
         if (resolvedClass && resolvedClass.COLLECTION) {
            return resolvedClass.COLLECTION
         }
         if (instanceOf === 'Entity') {
            return 'entities'
         }
         if (instanceOf === 'User') {
            return 'user'
         }
         return instanceOf
      }
      return instanceOf.COLLECTION || ''
   }

   /**
    * Dynamically ensures that a table exists with the correct columns derived from properties.
    * 
    * @param tableName - The name of the table to verify/create.
    * @param properties - The schema properties mapping to columns.
    */
   protected async _ensureTableByName(tableName: string, properties: any): Promise<void> {
      const tableLower = tableName.toLowerCase()
      const tableCheck = await this._query(
         `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
         [tableLower]
      )

      if (tableCheck.rowCount === 0) {
         let query = `CREATE TABLE IF NOT EXISTS "${tableLower}" (\n    id VARCHAR(255) PRIMARY KEY`

         const propsArray: any[] = Array.isArray(properties)
            ? properties
            : Object.entries(properties).map(([name, def]: [string, any]) => ({
                 name,
                 type: def.type || (def.constructor && def.constructor.name),
                 constructor: def.constructor,
              }))

         propsArray.forEach((propDef: any) => {
            if (propDef.name === 'id') {
               return
            }
            const propName = propDef.name.toLowerCase()
            let columnType = 'TEXT'

            const type = propDef.type || (propDef.constructor && propDef.constructor.name)
            if (type === 'NumberProperty' || type === 'number') {
               columnType = 'NUMERIC'
            } else if (type === 'BooleanProperty' || type === 'boolean') {
               columnType = 'BOOLEAN'
            } else if (type === 'DateTimeProperty' || type === 'datetime') {
               columnType = 'TIMESTAMP'
            } else if (type === 'ArrayProperty' || type === 'array') {
               columnType = 'JSONB'
            } else if (type === 'ObjectProperty' || type === 'object') {
               columnType = 'VARCHAR(255)'
            }

            query += `,\n    "${propName}" ${columnType}`
         })

         query += `\n)`
         await this._query(query)
         Backend.info(`[PGA] Created table "${tableLower}"`)
      }
   }

   /**
    * Ensures that the database table for the given DataObject's collection exists.
    * If the table does not exist, it automatically creates it.
    * Additionally, ensures that any related join tables for ObjectProperty references
    * are also created so that LEFT JOIN queries do not crash on non-existent tables.
    * 
    * @param dataObject - The DataObject payload defining properties and collection.
    * @returns A promise resolving when the table and relation tables exist.
    */
   protected async _ensureTable(dataObject: DataObjectClass<any>): Promise<void> {
      const collection = this.getCollection(dataObject)
      if (!collection) {
         throw new BackendError(`[PGA] Cannot determine collection name`)
      }

      await this._ensureTableByName(collection, dataObject.properties)

      // Automatically guarantee existence of joined relation tables to prevent SQL relation failures
      for (const prop of Object.keys(dataObject.properties)) {
         const propDef = dataObject.properties[prop]
         if (
            propDef.constructor.name === 'ObjectProperty' &&
            propDef.instanceOf
         ) {
            const table = this._resolveTable(propDef.instanceOf)
            if (table) {
               const resolvedClass =
                  typeof propDef.instanceOf === 'string'
                     ? Core.getClass(propDef.instanceOf)
                     : propDef.instanceOf

               if (resolvedClass && resolvedClass.PROPS_DEFINITION) {
                  await this._ensureTableByName(table, resolvedClass.PROPS_DEFINITION)
               } else {
                  // Fallback to bare relation table schema required for successful join logic
                  await this._ensureTableByName(table, [
                     { name: 'name', type: 'StringProperty' }
                  ])
               }
            }
         }
      }
   }

   /**
    * Translates a DataObject creation request into an `INSERT INTO` SQL query.
    * Generates a UUID automatically if none is requested.
    * 
    * @param dataObject - The DataObject payload.
    * @param desiredUid - Optional explicit UUID to use as primary key.
    * @returns A promise resolving to the saved DataObject.
    * @throws {BackendError} If a UID already exists on the object.
    */
   async create(
      dataObject: DataObjectClass<any>,
      desiredUid: string | undefined
   ): Promise<DataObjectClass<any>> {
      try {
         if (dataObject.uid) {
            throw new BackendError(
               `Data object already has an uid and can't be created`
            )
         }

         const uid = desiredUid || randomUUID()

         await this._ensureTable(dataObject)

         // execute middlewares
         await this.executeMiddlewares(dataObject, BackendAction.CREATE, 'before', {
            useDateFormat: true,
         })

         const data = dataObject.toJSON({
            withoutURIData: true,
            converters: {
               datetime: (v: any) => (v ? new Date(v).toISOString() : v),
            },
         })

         let query = `INSERT INTO "${dataObject.uri.collection?.toLowerCase()}" (id`
         let values = `VALUES ($1`
         Object.keys(data).forEach((key, i) => {
            query += `, ${key.toLowerCase()}`
            values += `, $${i + 2}`
         })
         query += `) `
         values += `)`

         Backend.debug(`[PGA] ${query}${values}`)

         const pgData = [uid, ...this._prepareData(data, false)]

         Backend.debug(`[PGA] Values ${JSON.stringify(pgData)}`)

         await this._query(`${query}${values}`, pgData)

         dataObject.uri.path = this._buildPath(dataObject, uid)
         dataObject.uri.label = data && Reflect.get(data, 'name')
         dataObject.isPersisted(true)
         Backend.info(
            `[PGA] Saved object "${data.name}" at path ${dataObject.path}`
         )

         await this.executeMiddlewares(dataObject, BackendAction.CREATE, 'after', {
            useDateFormat: true,
         })

         return dataObject
      } catch (err) {
         console.log(err)
         Backend.error((err as Error).message)
         throw new BackendError((err as Error).message)
      }
   }

   /**
    * Translates a read request into a `SELECT * ... LEFT JOIN ...` query.
    * Automatically handles joins for relational `ObjectProperty` fields.
    * 
    * @param dataObject - The DataObject to populate, containing the UID to fetch.
    * @returns A promise resolving to the populated DataObject.
    * @throws {NotFoundError} If the query returns 0 rows.
    */
   async read(dataObject: DataObjectClass<any>): Promise<DataObjectClass<any>> {
      const path = dataObject.path
      const collection = this.getCollection(dataObject)

      const parts = path.split('/')
      if (parts.length < 2 || parts.length % 2 !== 0) {
         throw new BackendError(
            `[PGA] path parts number should be even, received: '${path}'`
         )
      }

      await this._ensureTable(dataObject)

      Backend.debug(`[PGA] Getting document ${path}`)

      if (!collection) {
         throw new BackendError(
            `[PGA] Can't find collection matching object to query`
         )
      }

      const alias = 'coll'
      const query: string[] = []
      const fields: string[] = [`${alias}.id`]
      const caseMap = {}

      query.push(`SELECT * FROM "${collection.toLowerCase()}" AS coll`)

      // prepare joins
      Object.keys(dataObject.properties).forEach((prop) => {
         const lcProp = `${prop.toLowerCase()}`
         Reflect.set(caseMap, lcProp, prop)
         if (
            dataObject.properties[prop].constructor.name === 'ObjectProperty' &&
            dataObject.properties[prop].instanceOf
         ) {
            // Backend.debug(
            //    `Adding join table for property ${prop} instance of ${dataObject.properties[prop].instanceOf}`
            // )

            const joinAlias = `${prop.toLowerCase()}_table`

            const table = this._resolveTable(dataObject.properties[prop].instanceOf)

            query.push(
               `LEFT JOIN "${table.toLowerCase()}" AS ${joinAlias} ON ${joinAlias}.id = coll.${prop.toLowerCase()}`
            )
            fields.push(
               `CASE WHEN ${alias}.${lcProp} IS NOT NULL THEN json_build_object('ref', CONCAT('${table}/', ${alias}.${lcProp}), 'path', CONCAT('${table}/', ${alias}.${lcProp}), 'label', ${joinAlias}.name || '') ELSE NULL  END AS ${prop} `
            )
         } else {
            fields.push(`${alias}.${prop.toLowerCase()} AS ${prop}`)
         }
      })

      const queryString = `${query
         .join(' ')
         .replace('*', fields.join(', '))} WHERE coll.id = '${
         parts[parts.length - 1]
      }'`

      Backend.debug(`[PGA] SQL ${queryString}`)

      const result = await this._query(queryString)

      if (result.rowCount === 0) {
         throw new NotFoundError(`[PGA] No document matches path '${path}'`)
      }

      let doc = result.rows[0]

      Object.keys(dataObject.properties).forEach((field) => {
         Reflect.set(doc, field, doc[field.toLowerCase()])
      })

      dataObject.populate(result.rows[0])

      await this.executeMiddlewares(dataObject, BackendAction.READ, 'after')

      return dataObject
   }

   /**
    * Translates an update request into an `UPDATE ... SET ...` query.
    * Uses `ignoreUnchanged` to efficiently update only modified fields.
    * 
    * @param dataObject - The DataObject containing modifications.
    * @returns A promise resolving to the updated DataObject.
    */
   async update(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>> {
      if (dataObject.uid === undefined) {
         throw new Error('DataObject has no uid')
      }

      await this._ensureTable(dataObject)

      Backend.debug(`[PGA] Updating document ${dataObject.path}`)

      // execute middlewares
      await this.executeMiddlewares(dataObject, BackendAction.UPDATE, 'before')

      const data = dataObject.toJSON({
         withoutURIData: true,
         ignoreUnchanged: true,
         converters: { datetime: (ts: number) => ts / 1000 },
      })

      if (Object.keys(data).length === 0) {
         Backend.warn('[PGA] Nothing to update')
         return dataObject
      }

      Backend.debug(`[PGA] Data to update ${JSON.stringify(data)}`)

      const updates: string[] = []
      const values: any[] = []
      let i = 1

      Object.entries(data).forEach(([key, value]: [string, any]) => {
         const prop = dataObject.get(key)

         // Handle foreign key references
         if (
            this._params['useNativeForeignKeys'] &&
            this._params['useNativeForeignKeys'] === true &&
            typeof value === 'object' &&
            value !== null &&
            Reflect.has(value, 'ref')
         ) {
            const resourcePart = value.ref.split('/').pop()
            if (resourcePart.indexOf('.') === -1) {
               value = resourcePart
            }
         }

         // Serialize objects and arrays to JSON strings
         if (
            Array.isArray(value) ||
            (typeof value === 'object' && value !== null)
         ) {
            value =
               Array.isArray(value) && value.length > 0
                  ? value
                  : JSON.stringify(value)
         }

         if (prop && prop.constructor.name === 'DateTimeProperty') {
            updates.push(`${key.toLowerCase()} = to_timestamp($${i})`)
         } else {
            updates.push(`${key.toLowerCase()} = $${i}`)
         }

         values.push(value)
         i++
      })

      if (updates.length > 0) {
         const query = `UPDATE "${dataObject.uri.collection?.toLowerCase()}" SET ${updates.join(', ')} WHERE id = '${dataObject.uid}'`

         Backend.debug(`[PGA] ${query}`)
         Backend.debug(`[PGA] Values ${JSON.stringify(values)}`)

         await this._query(query, values)
      } else {
         Backend.warn(`[PGA] No data to update`)
      }

      await this.executeMiddlewares(dataObject, BackendAction.UPDATE, 'after')

      return dataObject
   }

   /**
    * Handles object deletion. Converts to an `UPDATE` query setting `status` if soft-deleted,
    * or a `DELETE FROM` query if `hardDelete` is forced.
    * 
    * @param dataObject - The DataObject to remove.
    * @param hardDelete - Force an absolute SQL DELETE regardless of softDelete configs.
    * @returns A promise resolving to the processed DataObject.
    */
   async delete(
      dataObject: DataObjectClass<any>,
      hardDelete = false
   ): Promise<DataObjectClass<any>> {
      if (dataObject.uid === undefined) {
         throw new BackendError('Dataobject has no uid')
      }

      await this._ensureTable(dataObject)

      // execute middlewares
      await this.executeMiddlewares(dataObject, BackendAction.DELETE, 'before', {
         useDateFormat: true,
      })

      if (hardDelete === false) {
         dataObject.set('status', statuses.DELETED)
         let query = `UPDATE "${dataObject.uri.collection?.toLowerCase()}" SET status = $1 WHERE id = $2`
         await this._query(query, [statuses.DELETED, dataObject.uid])
      } else {
         await this._query(
            `DELETE FROM "${dataObject.uri.collection?.toLowerCase()}" WHERE id = $1`,
            [dataObject.uid]
         )
      }

      dataObject.uri = new ObjectUri()

      await this.executeMiddlewares(dataObject, BackendAction.DELETE, 'after', {
         useDateFormat: true,
      })

      return dataObject
   }

   /**
    * Clears an entire table using a high-speed SQL `TRUNCATE TABLE` command.
    * 
    * @param collection - The table name to truncate.
    * @param batchSize - Ignored in Postgres as TRUNCATE handles all rows.
    */
   async deleteCollection(collection: string, batchSize = 500): Promise<void> {
      Backend.debug(`Deleting all records from collection '${collection}'`)
      const tableLower = collection.toLowerCase()
      const tableCheck = await this._query(
         `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
         [tableLower]
      )
      if (tableCheck.rowCount && tableCheck.rowCount > 0) {
         await this._query(`TRUNCATE TABLE "${tableLower}"`)
      }
   }

   /**
    * Convert array into SQL expression
    * @param from Array of strings or numbers
    * @returns string
    */
   protected _array2String(from: any[]) {
      let str = ''
      from.forEach((elem: string | Number, i) => {
         if (i > 0) {
            str += ','
         }
         str += `'${elem}'`
      })

      return `(${str})`
   }

   /**
    * Translates Quatrain's `Query` logic (Filters, Limits) into a complex SQL `SELECT` statement.
    * Supports ILIKE string searches, JSONB array traversals, and relational joins.
    * 
    * @param dataObject - The template DataObject defining the table and mapping.
    * @param filters - Active `Filters` limiting the result set.
    * @param pagination - Limit, batch size, and sorting configurations.
    * @param parent - Optional parent context for scoping queries.
    * @returns A promise resolving to hydrated objects and count metadata.
    */
   async find(
      dataObject: DataObjectClass<any>,
      filters: Filters | Filter[] | undefined = undefined,
      pagination: SortAndLimit | undefined = undefined,
      parent: DataObjectClass<any> | undefined = undefined
   ): Promise<QueryResultType<DataObjectClass<any>>> {
      try {
         //  use parent path to start fullPath, if available
         let fullPath = parent ? `${parent.path}/` : ''
         if (dataObject.path && dataObject.path !== ObjectUri.DEFAULT) {
            fullPath += `${dataObject.path}/`
         }
         const collection = this.getCollection(dataObject)

         if (!collection) {
            throw new BackendError(
               `[PGA] Can't find collection matching object to query`
            )
         }

         await this._ensureTable(dataObject)

         Backend.debug(`[PGA] Preparing query on '${collection}'`)

         let hasFilters = false
         const alias = 'coll'
         const query: string[] = []
         const fields: string[] = [`${alias}.id`]
         const caseMap = {}

         query.push(`SELECT * FROM "${collection.toLowerCase()}" AS coll`)

         // prepare joins
         Object.keys(dataObject.properties).forEach((prop) => {
            const lcProp = `${prop.toLowerCase()}`
            Reflect.set(caseMap, lcProp, prop)
            if (
               dataObject.properties[prop].constructor.name ===
                  'ObjectProperty' &&
               dataObject.properties[prop].instanceOf
            ) {
               // Backend.debug(
               //    `Adding join table for property ${prop} instance of ${dataObject.properties[prop].instanceOf}`
               // )

               const joinAlias = `${prop.toLowerCase()}_table`

               const table = this._resolveTable(dataObject.properties[prop].instanceOf)

               query.push(
                  `LEFT JOIN "${table.toLowerCase()}" AS ${joinAlias} ON ${joinAlias}.id = coll.${prop.toLowerCase()}`
               )
               fields.push(
                  `CASE WHEN ${alias}.${lcProp} IS NOT NULL THEN json_build_object('ref', CONCAT('${table}/', ${alias}.${lcProp}), 'path', CONCAT('${table}/', ${alias}.${lcProp}), 'label', ${joinAlias}.name || '') ELSE NULL  END AS ${prop} `
               )
            } else {
               fields.push(`${alias}.${prop.toLowerCase()} AS ${prop}`)
            }
         })

         if (parent) {
            query.push(`WHERE coll.${dataObject.parentProp}='${parent.uid}'`)
         }

         if (filters instanceof Filters) {
            hasFilters = true
         } else if (Array.isArray(filters)) {
            // list of filters objects
            filters.forEach((filter, i) => {
               query.push(parent && i === 0 ? 'AND' : i > 0 ? 'AND' : 'WHERE')

               let addPrefix = true
               let realProp: any = filter.prop
               let realOperator: string
               let realValue = filter.value

               if (filter.prop.indexOf('.') > -1) {
                  // Condition is on a sub-object on the form 'model.property'
                  const parts = filter.prop.toLowerCase().split('.')
                  const joinAlias = `${parts[0]}_table`
                  realProp = `${joinAlias}.${parts[1]}`
                  realOperator = operatorsMap[filter.operator]
                  addPrefix = false
               } else if (filter.prop === 'keywords') {
                  realProp = '('
                  realOperator = ''
                  realValue = `%${filter.value}%`
                  const props = dataObject.getProperties(StringProperty.name)
                  Object.keys(props).forEach(
                     (rp, j) =>
                        (realProp += `${
                           j > 0 ? ' OR ' : ''
                        }${alias}.${rp.toLowerCase()} ILIKE '${realValue}'`)
                  )
                  realProp += ')'
                  realValue = undefined
                  addPrefix = false
               } else if (
                  filter.prop !== AbstractBackendAdapter.PKEY_IDENTIFIER &&
                  !dataObject.has(filter.prop)
               ) {
                  throw new BackendError(
                     `[PGA] No such property '${filter.prop}' on model'`
                  )
               } else if (
                  filter.prop === AbstractBackendAdapter.PKEY_IDENTIFIER
               ) {
                  realProp = 'id'
                  realOperator = operatorsMap[filter.operator]
               } else {
                  const property = dataObject.get(filter.prop)

                  if (
                     property.constructor.name === 'ArrayProperty' &&
                     Array.isArray(realValue)
                  ) {
                     // we only compara arrays without using operator
                     query.push(
                        `ARRAY['${realValue.join("','")}'] ${
                           operatorsMap[filter.operator]
                        } ${alias}.${realProp}`
                     )
                     return
                  } else if (property.constructor.name === 'ObjectProperty') {
                     if (filter.value instanceof ObjectUri) {
                        // only keep uuid
                        realValue = filter.value.uid
                     } else if (
                        filter.value &&
                        typeof filter.value === 'object' &&
                        filter.value.ref
                     ) {
                        realValue = filter.value.ref.split('/')[1]
                     } else if (typeof filter.value === 'string') {
                         const collectionName = this._resolveTable(dataObject.properties[filter.prop].instanceOf)
                        realValue = filter.value.replace(
                           `${collectionName}/`,
                           ''
                        )
                     } else {
                        realValue =
                           (filter.value &&
                              filter.value.uri &&
                              filter.value.uri.path &&
                              filter.value.uri.path.split('/')[1]) ||
                           filter.value
                     }
                  }
                  realOperator = operatorsMap[filter.operator]
               }

               if (realOperator === operatorsMap['containsAny']) {
                  // Use 'containsAny' for queries in arrays which query structure is weird
                  query.push(`'${realValue}'=ANY(${alias}.${realProp})`)
               } else if (
                  realOperator === operatorsMap['equals'] &&
                  realValue === 'null'
               ) {
                  query.push(`${alias}.${realProp} is null`)
               } else {
                  if (realOperator === operatorsMap.like) {
                     realValue = `%${realValue}%`
                  }
                  if (
                     realOperator === operatorsMap.isNull ||
                     realOperator === operatorsMap.isNotNull
                  ) {
                     realValue = undefined
                  }
                  query.push(
                     `${
                        addPrefix ? `${alias}.` : ''
                     }${realProp} ${realOperator} ${
                        realValue !== undefined
                           ? `${
                                Array.isArray(realValue)
                                   ? this._array2String(realValue)
                                   : `'${realValue}'`
                             }`
                           : ''
                     }`
                  )
               }

               Backend.debug(
                  `[PGA] Filter added: ${realProp} ${realOperator} ${realValue}`
               )
            })
         }

         Backend.debug(`[PGA] SQL ${query.join(' ')}`)

         const countSnapshot = await this._query(
            `${query.join(' ').replace('*', 'COUNT(*) as total')}`
         )

         Backend.debug(`[PGA] Counting records ${countSnapshot.rows[0].total}`)

         let sortField: string[] = []
         if (pagination) {
            pagination.sortings.forEach((sorting: Sorting, i) => {
               query.push(i == 0 ? `ORDER BY` : ',')

               query.push(`${alias}.${sorting.prop} ${sorting.order}`)
               if (sorting.prop !== undefined) {
                  sortField.push(`${sorting.prop} ${sorting.order}`)
               }
            })
            if (pagination?.limits.batch !== -1) {
               query.push(`LIMIT ${pagination.limits.batch}`)
            }
            query.push(`OFFSET ${pagination.limits.offset || 0}`)
         }

         const literal = `${query.join(' ').replace('*', fields.join(', '))}`
         Backend.debug(`[PGA] Full SQL ${literal}`)

         const result = await this._query(literal)

         const meta: QueryMetaType = {
            count: Number.parseInt(countSnapshot.rows[0].total),
            offset: pagination?.limits.offset || 0,
            batch: pagination?.limits.batch || 20,
            sortField: sortField.join(', '),
            executionTime: Backend.timestamp(),
            debug: { sql: query.join(' ') },
         }

         const items: DataObjectClass<any>[] = []

         for (let doc of result.rows || []) {
            Object.keys(caseMap).forEach((field) => {
               Reflect.set(doc, Reflect.get(caseMap, field), doc[field])
            })
            const newDataObject: DataObjectClass<any> = await dataObject.clone({
               ...doc,
            })

            let newDataObjectUri = ``
            if (newDataObject.has('parent')) {
               // if data contains a parent, it acts as a base path
               if (
                  !(
                     newDataObject.val('parent') &&
                     newDataObject.val('parent').path
                  )
               ) {
                  throw new BackendError(
                     `DataObject has parent but parent is not persisted`
                  )
               }
               newDataObjectUri = `${newDataObject.get('parent')._value._path}/`
            }

            newDataObjectUri += `${this.getCollection(dataObject)}/${doc.id}`

            newDataObject.uri = new ObjectUri(
               newDataObjectUri,
               newDataObject.val('name')
            )

            items.push(newDataObject)
         }

         return { items, meta }
      } catch (err) {
         console.log(err)
         throw new BackendError(
            `Query failed for '${dataObject.class.name}': ${
               (err as Error).message
            }`
         )
      }
   }

   /**
    * Generates the SQL `CREATE TABLE` and `DROP TABLE` statements required to initialize
    * a collection's storage in PostgreSQL, mapping Quatrain Property types to SQL Column types.
    * 
    * @param collection - The table name.
    * @param properties - The property dictionary of the model.
    * @returns Up and Down migration SQL strings.
    */
   generateCreateSql(collection: string, properties: any[]): { upSql: string; downSql: string } {
      let query = `CREATE TABLE IF NOT EXISTS "${collection.toLowerCase()}" (\n    id VARCHAR(255) PRIMARY KEY`

      properties.forEach((propDef: any) => {
         const propName = propDef.name.toLowerCase()
         let columnType = 'TEXT'

         const type = propDef.type || propDef.constructor.name
         if (type === 'NumberProperty') {
            columnType = 'NUMERIC'
         } else if (type === 'BooleanProperty') {
            columnType = 'BOOLEAN'
         } else if (type === 'DateTimeProperty') {
            columnType = 'TIMESTAMP'
         } else if (type === 'ArrayProperty') {
            columnType = 'JSONB'
         } else if (type === 'ObjectProperty') {
            columnType = 'VARCHAR(255)'
         }

         query += `,\n    "${propName}" ${columnType}`
      })

      query += `\n)`

      return {
         upSql: `await adapter.rawQuery(\`${query}\`)`,
         downSql: `await adapter.rawQuery(\`DROP TABLE IF EXISTS "${collection.toLowerCase()}"\`)`,
      }
   }

   /**
    * Generates the SQL `ALTER TABLE` statements to apply a schema delta (add/drop columns).
    * 
    * @param collection - The table name.
    * @param delta - The SchemaDelta tracking property additions/removals.
    * @returns Arrays of Up and Down migration SQL statements.
    */
   generateDeltaSql(collection: string, delta: any): { upSql: string[]; downSql: string[] } {
      const upSql: string[] = []
      const downSql: string[] = []

      // Added columns
      delta.added.forEach((propDef: any) => {
         const propName = propDef.name.toLowerCase()
         let columnType = 'TEXT'

         const type = propDef.type || propDef.constructor.name
         if (type === 'NumberProperty') columnType = 'NUMERIC'
         else if (type === 'BooleanProperty') columnType = 'BOOLEAN'
         else if (type === 'DateTimeProperty') columnType = 'TIMESTAMP'
         else if (type === 'ArrayProperty') columnType = 'JSONB'
         else if (type === 'ObjectProperty') columnType = 'VARCHAR(255)'

         upSql.push(`await adapter.rawQuery(\`ALTER TABLE "${collection.toLowerCase()}" ADD COLUMN "${propName}" ${columnType}\`)`)
         downSql.push(`await adapter.rawQuery(\`ALTER TABLE "${collection.toLowerCase()}" DROP COLUMN "${propName}"\`)`)
      })

      // Removed columns
      delta.removed.forEach((propDef: any) => {
         const propName = propDef.name.toLowerCase()
         let columnType = 'TEXT'

         const type = propDef.type || propDef.constructor.name
         if (type === 'NumberProperty') columnType = 'NUMERIC'
         else if (type === 'BooleanProperty') columnType = 'BOOLEAN'
         else if (type === 'DateTimeProperty') columnType = 'TIMESTAMP'
         else if (type === 'ArrayProperty') columnType = 'JSONB'
         else if (type === 'ObjectProperty') columnType = 'VARCHAR(255)'

         upSql.push(`await adapter.rawQuery(\`ALTER TABLE "${collection.toLowerCase()}" DROP COLUMN "${propName}"\`)`)
         downSql.push(`await adapter.rawQuery(\`ALTER TABLE "${collection.toLowerCase()}" ADD COLUMN "${propName}" ${columnType}\`)`)
      })

      return { upSql, downSql }
   }
}
