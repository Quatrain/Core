import {
   ObjectUri,
   NotFoundError,
   statuses,
   StringProperty,
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
import { randomUUID } from 'crypto'
import sqlite3, { Statement } from 'sqlite3'
import { open, Database } from 'sqlite'

const operatorsMap: { [x: string]: string } = {
   equals: '=',
   notEquals: '!=',
   greater: '>',
   greaterOrEquals: '>=',
   lower: '<',
   lowerOrEquals: '<=', // Corrected from '>' in PostgreSQL implementation
   like: 'LIKE',
   contains: 'IN',
   notContains: 'NOT IN',
   containsAll: 'JSON_EXTRACT', // Use JSON_EXTRACT with custom logic
   containsAny: 'JSON_EXTRACT', // Use JSON_EXTRACT with custom logic
   isNull: 'IS NULL',
   isNotNull: 'IS NOT NULL',
}

/**
 * SQLite Backend Adapter for Quatrain
 */
export class SQLiteAdapter extends AbstractBackendAdapter {
   protected _connection: undefined | Database<sqlite3.Database>
   protected _dbPath: string

   constructor(params: BackendParameters = {}) {
      super(params)
      this._dbPath = (params.config?.database as string) || ':memory:'
   }

   protected _buildPath(dataObject: DataObjectClass<any>, uid?: string) {
      const collection = this.getCollection(dataObject)
      if (!collection) {
         throw new BackendError(
            `[SQLA] Can't define record path without a collection name`
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

      Backend.info(`[SQLA] Record path is '${path}'`)

      return path
   }

   /**
    * Executes a raw query on the backend.
    * Only supported by SQL adapters.
    */
   async rawQuery(sql: string, params: any[] = []): Promise<any> {
      const connection = await this._connect()
      return await connection.all(sql, params)
   }

   protected async _connect(): Promise<Database<sqlite3.Database>> {
      if (!this._connection) {
         // Open SQLite database
         this._connection = await open<sqlite3.Database, Statement>({
            filename: this._dbPath,
            driver: sqlite3.Database,
         })

         // Enable foreign keys support
         await this._connection.run('PRAGMA foreign_keys = ON')

         // Configure SQLite to handle JSON arrays and objects
         // SQLite doesn't support CREATE FUNCTION syntax, so we'll use built-in JSON functions
         // Enable JSON1 extension if available
         try {
            await this._connection.exec('SELECT json_valid(\'[]\')') // Test if JSON1 is available
         } catch (err) {
            Backend.warn('[SQLA] JSON1 extension not available, array operations may be limited')
         }
      }

      return this._connection
   }

   /**
    * Process data for compatibility
    * @param data
    * @param filterNulls
    * @returns
    */
   protected _prepareData(data: any, filterNulls = true) {
      if (filterNulls) {
         data = Object.entries(data)
            .filter(([_, v]) => v !== null && v !== '')
            .map(([_, v]) => v)
      } else {
         data = Object.values(data)
      }

      // Handle arrays by converting them to JSON strings for SQLite
      data.forEach((el: any, key: number) => {
         if (Array.isArray(el)) {
            data[key] = JSON.stringify(el)
         }
      })

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
    * Ensure the collection table exists in SQLite
    * @param dataObject DataObject to create table for
    */
   private async _ensureTable(dataObject: DataObjectClass<any>): Promise<void> {
      const collection = this.getCollection(dataObject)
      if (!collection) {
         throw new BackendError(`[SQLA] Cannot determine collection name`)
      }

      const db = await this._connect()
      const tableExists = await db.get(
         `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
         [collection.toLowerCase()]
      )

      if (!tableExists) {
         // Table doesn't exist, create it
         let query = `CREATE TABLE IF NOT EXISTS ${collection.toLowerCase()} (
             id TEXT PRIMARY KEY`

         // Add columns based on dataObject properties
         Object.entries(dataObject.properties).forEach(
            ([prop, propDef]: [prop: string, propDef: any]) => {
               const propName = prop
               let columnType = 'TEXT'

               // Map property types to SQLite column types
               if (propDef.constructor.name === 'NumberProperty') {
                  columnType = 'REAL'
               } else if (propDef.constructor.name === 'BooleanProperty') {
                  columnType = 'INTEGER'
               } else if (propDef.constructor.name === 'DateTimeProperty') {
                  columnType = 'INTEGER' // Store as timestamp
               } else if (propDef.constructor.name === 'ArrayProperty') {
                  columnType = 'TEXT' // Store as JSON string
               } else if (propDef.constructor.name === 'ObjectProperty') {
                  columnType = 'TEXT' // Store reference ID
               }

               query += `,\n${propName} ${columnType}`
            }
         )

         query += `)`
         await db.exec(query)
         Backend.info(`[SQLA] Created table ${collection.toLowerCase()}`)
      }
   }

   /**
    * Create record in backend
    * @param dataObject DataObject instance to persist in backend
    * @param desiredUid Desired unique ID for record
    * @returns DataObject
    */
   async create(
      dataObject: DataObjectClass<any>,
      desiredUid: string | undefined
   ): Promise<DataObjectClass<any>> {
      return new Promise(async (resolve, reject) => {
         try {
            if (dataObject.uid) {
               throw new BackendError(
                  `Data object already has an uid and can't be created`
               )
            }

            const uid = desiredUid || randomUUID()

            // Make sure table exists
            await this._ensureTable(dataObject)

            // execute middlewares
            await this.executeMiddlewares(dataObject, BackendAction.CREATE, {
               useDateFormat: true,
            })

            const data = dataObject.toJSON({
               withoutURIData: true,
               converters: {
                  datetime: (v: any) => (v ? new Date(v).getTime() : v), // Store as timestamp in SQLite
               },
            })

            const db = await this._connect()
            const collection = this.getCollection(dataObject)

            let columns = ['id']
            let placeholders = ['?']
            let values = [uid]

            Object.entries(data).forEach(
               ([key, value]: [key: string, value: any]) => {
                  columns.push(`"${key}"`)
                  placeholders.push('?')

                  // Convert arrays and objects to JSON strings
                  if (
                     Array.isArray(value) ||
                     (typeof value === 'object' && value !== null)
                  ) {
                     values.push(JSON.stringify(value))
                  } else {
                     values.push(value)
                  }
               }
            )

            const query = `INSERT INTO ${collection?.toLowerCase()} (${columns.join(
               ', '
            )})
                           VALUES (${placeholders.join(', ')})`

            Backend.debug(`[SQLA] ${query}`)
            Backend.debug(`[SQLA] Values ${JSON.stringify(values)}`)

            await db.run(query, values)

            dataObject.uri.path = this._buildPath(dataObject, uid)
            dataObject.uri.label = data && Reflect.get(data, 'name')
            dataObject.isPersisted(true)

            Backend.info(
               `[SQLA] Saved object "${data.name}" at path ${dataObject.path}`
            )

            resolve(dataObject)
         } catch (err) {
            console.error(err)
            Backend.error((err as Error).message)
            reject(new BackendError((err as Error).message))
         }
      })
   }

   async read(dataObject: DataObjectClass<any>): Promise<DataObjectClass<any>> {
      const path = dataObject.path
      const collection = this.getCollection(dataObject)

      const parts = path.split('/')
      if (parts.length < 2 || parts.length % 2 !== 0) {
         throw new BackendError(
            `[SQLA] path parts number should be even, received: '${path}'`
         )
      }

      Backend.info(`[SQLA] Getting document ${path}`)

      if (!collection) {
         throw new BackendError(
            `[SQLA] Can't find collection matching object to query`
         )
      }

      const db = await this._connect()
      const uid = parts[parts.length - 1]

      // Ensure table exists
      await this._ensureTable(dataObject)

      const result = await db.get(
         `SELECT * FROM ${collection.toLowerCase()} WHERE id = ?`,
         [uid]
      )

      if (!result) {
         throw new NotFoundError(`[SQLA] No document matches path '${path}'`)
      }

      // Process object references
      for (const prop in dataObject.properties) {
         const propDef = dataObject.properties[prop]

         if (
            propDef.constructor.name === 'ObjectProperty' &&
            propDef.instanceOf
         ) {
            const propValue = result[prop]

            if (propValue) {
               let refTable = undefined
               if (this._params.mapping && this._params.mapping[propDef.instanceOf]) {
                  refTable = this._params.mapping[propDef.instanceOf]
               } else if (propDef.instanceOf && propDef.instanceOf.COLLECTION) {
                  refTable = propDef.instanceOf.COLLECTION
               }

               if (refTable) {
                  // Look up the referenced object for its name
                  const refObject = await db.get(
                     `SELECT name FROM ${refTable.toLowerCase()} WHERE id = ?`,
                     [propValue]
                  )

                  if (refObject) {
                     result[prop] = {
                        ref: `${refTable}/${propValue}`,
                        path: `${refTable}/${propValue}`,
                        label: refObject.name || '',
                     }
                  }
               }
            }
         } else if (propDef.constructor.name === 'ArrayProperty' || propDef.constructor.name === 'MapProperty') {
            // Parse JSON arrays and objects
            try {
               if (result[prop]) {
                  result[prop] = JSON.parse(result[prop])
               }
            } catch (e) {
               Backend.warn(`[SQLA] Failed to parse JSON for ${prop}: ${e}`)
            }
         }


      }

      dataObject.populate(result)
      return dataObject
   }

   async update(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>> {
      if (dataObject.uid === undefined) {
         throw new Error('DataObject has no uid')
      }

      Backend.info(`[SQLA] Updating document ${dataObject.path}`)

      // execute middlewares
      await this.executeMiddlewares(dataObject, BackendAction.UPDATE)

      const data = dataObject.toJSON({
         withoutURIData: true,
         ignoreUnchanged: true,
         converters: {
            datetime: (ts: number) => ts, // Store directly as timestamp in SQLite
         },
      })

      if (Object.keys(data).length === 0) {
         Backend.warn('[SQLA] Nothing to update')
         return dataObject
      }

      const db = await this._connect()
      const collection = this.getCollection(dataObject)

      // Ensure table exists
      await this._ensureTable(dataObject)

      let updates: string[] = []
      let values: any[] = []

      Object.entries(data).forEach(
         ([key, value]: [key: string, value: any]) => {
            updates.push(`"${key}" = ?`)

            // Convert arrays and objects to JSON strings
            if (
               Array.isArray(value) ||
               (typeof value === 'object' && value !== null)
            ) {
               value = JSON.stringify(value)
            }

            values.push(value as string | number | boolean)
         }
      )

      if (updates.length === 0) {
         return dataObject
      }

      values.push(dataObject.uid)
      const query = `UPDATE ${collection?.toLowerCase()} SET ${updates.join(
         ', '
      )} WHERE id = ?`

      Backend.debug(`[SQLA] ${query}`)
      Backend.debug(`[SQLA] Values ${JSON.stringify(values)}`)

      await db.run(query, values)
      return dataObject
   }

   async delete(
      dataObject: DataObjectClass<any>,
      hardDelete = false
   ): Promise<DataObjectClass<any>> {
      if (dataObject.uid === undefined) {
         throw new BackendError('Dataobject has no uid')
      }

      const collection = this.getCollection(dataObject)
      if (!collection) {
         throw new BackendError(`[SQLA] Cannot determine collection name`)
      }

      // execute middlewares
      await this.executeMiddlewares(dataObject, BackendAction.DELETE, {
         useDateFormat: true,
      })

      const db = await this._connect()

      if (this._params.softDelete !== false && !hardDelete) {
         dataObject.set('status', statuses.DELETED)
         await db.run(
            `UPDATE ${collection.toLowerCase()} SET status = ? WHERE id = ?`,
            [statuses.DELETED, dataObject.uid]
         )
      } else {
         await db.run(`DELETE FROM ${collection.toLowerCase()} WHERE id = ?`, [
            dataObject.uid,
         ])
      }

      dataObject.uri = new ObjectUri()
      return dataObject
   }

   async deleteCollection(collection: string, batchSize = 500): Promise<void> {
      Backend.log(`Deleting all records from collection '${collection}'`)
      const db = await this._connect()

      // Check if table exists before trying to delete from it
      const tableExists = await db.get(
         `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
         [collection.toLowerCase()]
      )

      if (tableExists) {
         await db.run(`DELETE FROM ${collection.toLowerCase()}`)
      }
   }

   /**
    * Convert array into SQL expression
    * @param from Array of strings or numbers
    * @returns string
    */
   protected _array2String(from: (string | number)[]) {
      // For SQLite, we'll use the JSON functions to check arrays
      return `'${JSON.stringify(from)}'`
   }

   /**
    * Execute a query on a collection
    * @param dataObject
    * @param filters
    * @param pagination
    * @params parent
    * @returns
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
               `[SQLA] Can't find collection matching object to query`
            )
         }

         Backend.debug(`[SQLA] Preparing query on '${collection}'`)

         const db = await this._connect()

         // Ensure table exists
         await this._ensureTable(dataObject)

         let hasFilters = false
         const query: string[] = []
         const params: any[] = []
         const joinTables: { [key: string]: { table: string; alias: string } } =
            {}

         query.push(`SELECT * FROM ${collection.toLowerCase()}`)

         // Add joins for object references
         Object.entries(dataObject.properties).forEach(
            ([prop, propDef]: [prop: string, propDef: any]) => {
               if (
                  propDef.constructor.name === 'ObjectProperty' &&
                  propDef.instanceOf
               ) {
                  const propName = prop
                  const joinAlias = `${propName}_table`

                  let table = undefined
                  if (this._params.mapping && this._params.mapping[propDef.instanceOf]) {
                     table = this._params.mapping[propDef.instanceOf]
                  } else if (propDef.instanceOf && propDef.instanceOf.COLLECTION) {
                     table = propDef.instanceOf.COLLECTION
                  }

                  if (table) {
                     joinTables[prop] = { table, alias: joinAlias }

                     query.push(
                        `LEFT JOIN ${table.toLowerCase()} AS ${joinAlias}
                      ON ${joinAlias}.id = ${collection.toLowerCase()}.${propName}`
                     )
                  } else {
                     Backend.warn(`[SQLA] Skipping join for property ${prop} - no collection found`)
                  }
               }
            }
         )

         if (parent) {
            query.push(
               `WHERE ${collection.toLowerCase()}.${dataObject.parentProp} = ?`
            )
            params.push(parent.uid)
         }

         if (filters instanceof Filters) {
            hasFilters = true
            // SQLite doesn't support complex Filters object, but we'll mark it as handled
         } else if (Array.isArray(filters)) {
            // list of filters objects
            filters.forEach((filter, i) => {
               query.push(parent && i === 0 ? 'AND' : i > 0 ? 'AND' : 'WHERE')

               let realProp: any = filter.prop
               let realOperator: string = operatorsMap[filter.operator]
               let realValue = filter.value

               if (filter.prop === 'keywords') {
                  const keywordFilters: string[] = []

                  const props = dataObject.getProperties(StringProperty.name)
                  Object.keys(props).forEach((rp) => {
                     keywordFilters.push(
                        `${collection.toLowerCase()}.${rp} LIKE ?`
                     )
                     params.push(`%${filter.value as string}%`)
                  })

                  query.push(`(${keywordFilters.join(' OR ')})`)
               } else if (
                  filter.prop !== AbstractBackendAdapter.PKEY_IDENTIFIER &&
                  !dataObject.has(filter.prop)
               ) {
                  throw new BackendError(
                     `[SQLA] No such property '${filter.prop}' on object'`
                  )
               } else if (
                  filter.prop === AbstractBackendAdapter.PKEY_IDENTIFIER
               ) {
                  realProp = 'id'
               } else {
                  const property = dataObject.get(filter.prop)
                  realProp = filter.prop

                  if (
                     property.constructor.name === 'ArrayProperty' &&
                     Array.isArray(realValue)
                  ) {
                     // Use EXISTS with json_each for array containment in SQLite
                     const placeholders = realValue.map(() => 'json_each.value = ?').join(' OR ')
                     query.push(
                        `EXISTS (SELECT 1 FROM json_each(${collection.toLowerCase()}.${realProp}) WHERE ${placeholders})`
                     )
                     params.push(...(realValue as string[]))
                     // Skip further processing for this filter
                     Backend.debug(
                        `[SQLA] Array filter added: ${realProp} EXISTS ${String(realValue)}`
                     )
                  } else if (property.constructor.name === 'ObjectProperty') {
                     if (filter.value instanceof ObjectUri) {
                        realValue = filter.value.uid
                     } else if (
                        filter.value &&
                        typeof filter.value === 'object' &&
                        filter.value.ref
                     ) {
                        realValue = filter.value.ref.split('/')[1]
                     } else if (typeof filter.value === 'string') {
                        const collectionName =
                           this._params.mapping &&
                           this._params.mapping[
                              dataObject.properties[filter.prop].instanceOf
                           ]
                              ? this._params.mapping[
                                   dataObject.properties[filter.prop].instanceOf
                                ]
                              : dataObject.properties[filter.prop].instanceOf
                                   .COLLECTION
                        realValue = filter.value.replace(
                           `${collectionName}/`,
                           ''
                        )
                     } else if (
                        filter.value &&
                        typeof filter.value === 'object' &&
                        filter.value.uid
                     ) {
                        // Handle DataObject instances
                        realValue = filter.value.uid
                     } else {
                        realValue =
                           (filter.value &&
                              filter.value.uri &&
                              filter.value.uri.path &&
                              filter.value.uri.path.split('/')[1]) ||
                           filter.value
                     }
                  }

                  // Only add the filter query if it's not an ArrayProperty (which was already handled above)
                  if (!(property.constructor.name === 'ArrayProperty' && Array.isArray(realValue))) {
                     if (realOperator === operatorsMap['containsAny']) {
                        // Use EXISTS with json_each for array containment in SQLite
                        query.push(
                           `EXISTS (SELECT 1 FROM json_each(${collection.toLowerCase()}.${realProp}) WHERE json_each.value = ?)`
                        )
                        params.push(realValue)
                     } else if (
                        realOperator === operatorsMap['equals'] &&
                        realValue === 'null'
                     ) {
                        query.push(`${collection.toLowerCase()}.${realProp} IS NULL`)
                     } else if (
                        realOperator === operatorsMap['contains'] ||
                        realOperator === operatorsMap['notContains']
                     ) {
                        if (Array.isArray(realValue)) {
                           const placeholders = realValue.map(() => '?').join(', ')
                           query.push(
                              `${collection.toLowerCase()}.${realProp} ${realOperator} (${placeholders})`
                           )
                           params.push(...realValue)
                        } else {
                           query.push(
                              `${collection.toLowerCase()}.${realProp} ${realOperator} (?)`
                           )
                           params.push(realValue as string | number)
                        }
                     } else {
                        // Handle ObjectProperty specially for JSON-stored references
                        if (property && property.constructor.name === 'ObjectProperty') {
                           if (realOperator === operatorsMap.equals) {
                              // For ObjectProperty, check if the JSON contains the reference
                              query.push(
                                 `json_extract(${collection.toLowerCase()}.${realProp}, '$.ref') LIKE ?`
                              )
                              params.push(`%${realValue}`)
                           } else {
                              query.push(
                                 `${collection.toLowerCase()}.${realProp} ${realOperator} ?`
                              )
                              params.push(realValue)
                           }
                        } else if (realOperator === operatorsMap.like) {
                           query.push(
                              `${collection.toLowerCase()}.${realProp} ${realOperator} ?`
                           )
                           params.push(`%${realValue}%`)
                        } else if (
                           realOperator === operatorsMap.isNull ||
                           realOperator === operatorsMap.isNotNull
                        ) {
                           query.push(
                              `${collection.toLowerCase()}.${realProp} ${realOperator}`
                           )
                        } else {
                           query.push(
                              `${collection.toLowerCase()}.${realProp} ${realOperator} ?`
                           )
                           params.push(realValue)
                        }
                     }

                     Backend.debug(
                        `[SQLA] Filter added: ${realProp} ${realOperator} ${String(
                           realValue
                        )}`
                     )
                  }
               }
            })
         }

         // Count query - without pagination
         const countQuery = query.join(' ').replace('*', 'COUNT(*) as total')
         Backend.debug(`[SQLA] Count SQL ${countQuery}`)

         const countResult = await db.get(countQuery, params)
         const totalCount = countResult ? countResult.total : 0

         Backend.debug(`[SQLA] Counting records ${totalCount}`)

         // Add sorting and pagination
         let sortField: string[] = []
         if (pagination && pagination.sortings) {
            pagination.sortings.forEach((sorting: Sorting, i) => {
               query.push(i === 0 ? `ORDER BY` : ',')
               query.push(
                  `${collection.toLowerCase()}.${sorting.prop} ${
                     sorting.order
                  }`
               )
               if (sorting.prop !== undefined) {
                  sortField.push(`${sorting.prop} ${sorting.order.toUpperCase()}`)
               }
            })

            if (pagination?.limits.batch !== -1) {
               query.push(`LIMIT ?`)
               params.push(pagination.limits.batch)
            }

            if (pagination?.limits.offset) {
               query.push(`OFFSET ?`)
               params.push(pagination.limits.offset)
            }
         }

         const finalQuery = query.join(' ')
         Backend.debug(`[SQLA] Full SQL ${finalQuery}`)
         Backend.debug(`[SQLA] Params ${JSON.stringify(params)}`)

         const results = await db.all(finalQuery, params)

         const meta: QueryMetaType = {
            count: totalCount,
            offset: pagination?.limits.offset || 0,
            batch: pagination?.limits.batch || 20,
            sortField: sortField.join(', '),
            executionTime: Backend.timestamp(),
            debug: { sql: finalQuery, params },
         }

         const items: DataObjectClass<any>[] = []

         for (let doc of results || []) {
            // Process document before populating
            Object.entries(dataObject.properties).forEach(([prop, propDef]: [prop: string, propDef: any]) => {
               // Handle ObjectProperty references
               if (
                  propDef.constructor.name === 'ObjectProperty' &&
                  propDef.instanceOf
               ) {
                  const refValue = doc[prop]
                  if (refValue) {
                     const info = joinTables[prop]
                     
                     if (info) {
                        const label = doc[`${prop}_table_name`] || ''

                        doc[prop] = {
                           ref: `${info.table}/${refValue}`,
                           path: `${info.table}/${refValue}`,
                           label,
                        }
                     } else {
                        // Fallback when no join table info is available
                        // Try to determine table name from propDef
                        let tableName = undefined
                        if (this._params.mapping && this._params.mapping[propDef.instanceOf]) {
                           tableName = this._params.mapping[propDef.instanceOf]
                        } else if (propDef.instanceOf && propDef.instanceOf.COLLECTION) {
                           tableName = propDef.instanceOf.COLLECTION
                        }
                        
                        if (tableName) {
                           doc[prop] = {
                              ref: `${tableName}/${refValue}`,
                              path: `${tableName}/${refValue}`,
                              label: '',
                           }
                        }
                     }
                  }
               }
               // Handle array and map properties
               else if (propDef.constructor.name === 'ArrayProperty' || propDef.constructor.name === 'MapProperty') {
                  try {
                     if (doc[prop] && typeof doc[prop] === 'string') {
                        doc[prop] = JSON.parse(doc[prop])
                     }
                  } catch (e) {
                     Backend.warn(
                        `[SQLA] Failed to parse JSON for ${prop}: ${e}`
                     )
                  }
               }
            })

            // Map SQLite 'id' column back to Quatrain 'uid' property
            if (doc.id && !doc.uid) {
               doc.uid = doc.id
            }

            const newDataObject: DataObjectClass<any> = await dataObject.clone({
               ...doc,
            })

            let newDataObjectUri = ``
            if (newDataObject.has('parent')) {
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
         console.error(err)
         Backend.error(`[SQLA] Query failed: ${(err as Error).message}`)
         throw new BackendError(
            `Query failed for '${dataObject.class.name}': ${
               (err as Error).message
            }`
         )
      }
   }

   /**
    * Close the SQLite connection
    */
   async close(): Promise<void> {
      if (this._connection) {
         await this._connection.close()
         this._connection = undefined
      }
   }

   /**
    * Generates the SQL up and down statements to create a collection table.
    */
   generateCreateSql(collection: string, properties: any[]): { upSql: string; downSql: string } {
      let query = `CREATE TABLE IF NOT EXISTS "${collection.toLowerCase()}" (\n    id TEXT PRIMARY KEY`

      properties.forEach((propDef: any) => {
         const propName = propDef.name
         let columnType = 'TEXT'

         const type = propDef.type || propDef.constructor.name
         if (type === 'NumberProperty') {
            columnType = 'REAL'
         } else if (type === 'BooleanProperty') {
            columnType = 'INTEGER'
         } else if (type === 'DateTimeProperty') {
            columnType = 'INTEGER'
         } else if (type === 'ArrayProperty') {
            columnType = 'TEXT'
         } else if (type === 'ObjectProperty') {
            columnType = 'TEXT'
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
    * Generates the SQL up and down statements to apply a schema delta to a collection.
    */
   generateDeltaSql(collection: string, delta: any): { upSql: string[]; downSql: string[] } {
      const upSql: string[] = []
      const downSql: string[] = []

      // Added columns
      delta.added.forEach((propDef: any) => {
         const propName = propDef.name
         let columnType = 'TEXT'

         const type = propDef.type || propDef.constructor.name
         if (type === 'NumberProperty') {
            columnType = 'REAL'
         } else if (type === 'BooleanProperty') {
            columnType = 'INTEGER'
         } else if (type === 'DateTimeProperty') {
            columnType = 'INTEGER'
         }

         upSql.push(`await adapter.rawQuery(\`ALTER TABLE "${collection.toLowerCase()}" ADD COLUMN "${propName}" ${columnType}\`)`)
         // SQLite < 3.35 doesn't support DROP COLUMN, so we add a comment but keep the syntax
         downSql.push(`// NOTE: DROP COLUMN requires SQLite >= 3.35\n   // await adapter.rawQuery(\`ALTER TABLE "${collection.toLowerCase()}" DROP COLUMN "${propName}"\`)`)
      })

      // Removed columns
      delta.removed.forEach((propDef: any) => {
         const propName = propDef.name
         let columnType = 'TEXT'
         
         const type = propDef.type || propDef.constructor.name
         if (type === 'NumberProperty') columnType = 'REAL'
         else if (type === 'BooleanProperty') columnType = 'INTEGER'
         else if (type === 'DateTimeProperty') columnType = 'INTEGER'

         upSql.push(`// NOTE: DROP COLUMN requires SQLite >= 3.35\n   // await adapter.rawQuery(\`ALTER TABLE "${collection.toLowerCase()}" DROP COLUMN "${propName}"\`)`)
         downSql.push(`await adapter.rawQuery(\`ALTER TABLE "${collection.toLowerCase()}" ADD COLUMN "${propName}" ${columnType}\`)`)
      })

      return { upSql, downSql }
   }
}
