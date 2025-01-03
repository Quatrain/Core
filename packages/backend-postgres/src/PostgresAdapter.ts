import {
   ObjectUri,
   NotFoundError,
   statuses,
   StringProperty,
   ObjectProperty,
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
import { Client } from 'pg'

const operatorsMap: { [x: string]: string } = {
   equals: '=',
   notEquals: '!=',
   greater: '>',
   greaterOrEquals: '>=',
   lower: '<',
   lowerOrEquals: '>',
   contains: 'in',
   notContains: 'not in',
   containsAll: 'array-contains',
   containsAny: 'any',
}

/**
 * https://en.wikipedia.org/wiki/List_of_SQL_reserved_words
 */
export class PostgresAdapter extends AbstractBackendAdapter {
   protected _connection: undefined | Client

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

      Backend.log(`[FSA] Record path is '${path}'`)

      return path
   }
   protected async _connect(): Promise<Client> {
      if (!this._connection) {
         const {
            user = '',
            password = '',
            host = 'localhost',
            port = 5432,
            database = 'postgres',
         } = this._params.config
         this._connection = new Client({ host, port, database, user, password })
         await this._connection.connect()
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
         data = Object.values(data).filter((v) => v !== null && v !== '')
      } else {
         data = Object.values(data)
      }

      // convert reference for database Array only
      // data.forEach((el: any, key: number) => {
      //    if (Array.isArray(el) && el.length === 0) {
      //       data[key] = JSON.stringify(el)
      //    }
      // })

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

            // execute middlewares
            await this.executeMiddlewares(dataObject, BackendAction.CREATE, {
               useDateFormat: true,
            })

            const data = dataObject.toJSON({ withoutURIData: true })

            let query = `INSERT INTO ${dataObject.uri.collection?.toLowerCase()} (id`
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

            await (await this._connect()).query(`${query}${values}`, pgData)

            dataObject.uri.path = this._buildPath(dataObject, uid)
            dataObject.uri.label = data && Reflect.get(data, 'name')
            dataObject.isPersisted(true)
            Backend.info(
               `[PGA] Saved object "${data.name}" at path ${dataObject.path}`
            )

            resolve(dataObject)
         } catch (err) {
            console.log(err)
            Backend.log((err as Error).message)
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
            `[PGA] path parts number should be even, received: '${path}'`
         )
      }

      Backend.log(`[PGA] Getting document ${path}`)

      if (!collection) {
         throw new BackendError(
            `[PGA] Can't find collection matching object to query`
         )
      }

      const alias = 'coll'
      const query: string[] = []
      const fields: string[] = [`${alias}.id`]
      const caseMap = {}

      query.push(`SELECT * FROM ${collection.toLowerCase()} AS coll`)

      // prepare joins
      Object.keys(dataObject.properties).forEach((prop) => {
         const lcProp = `${prop.toLowerCase()}`
         Reflect.set(caseMap, lcProp, prop)
         if (
            dataObject.properties[prop].constructor.name === 'ObjectProperty' &&
            dataObject.properties[prop].instanceOf
         ) {
            Backend.debug(
               `Adding join table for property ${prop} instance of ${dataObject.properties[prop].instanceOf}`
            )

            const joinAlias = `${prop.toLowerCase()}_table`

            const table =
               this._params.mapping &&
               this._params.mapping[dataObject.properties[prop].instanceOf]
                  ? this._params.mapping[dataObject.properties[prop].instanceOf]
                  : dataObject.properties[prop].instanceOf.COLLECTION
            query.push(
               `LEFT JOIN ${table} AS ${joinAlias} ON ${joinAlias}.id = coll.${prop.toLowerCase()}`
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
         .replace('*', fields.join(', '))} WHERE coll.id = '${parts[1]}'`

      Backend.debug(`[PGA] SQL ${queryString}`)

      const result = await (await this._connect()).query(queryString)

      if (result.rowCount === 0) {
         throw new NotFoundError(`[PGA] No document matches path '${path}'`)
      }

      let doc = result.rows[0]

      Object.keys(dataObject.properties).forEach((field) => {
         Reflect.set(doc, field, doc[field.toLowerCase()])
      })

      dataObject.populate(result.rows[0])

      return dataObject
   }

   async update(
      dataObject: DataObjectClass<any>
   ): Promise<DataObjectClass<any>> {
      if (dataObject.uid === undefined) {
         throw new Error('DataObject has no uid')
      }

      Backend.info(`[PGA] Updating document ${dataObject.path}`)

      // execute middlewares
      await this.executeMiddlewares(dataObject, BackendAction.UPDATE)

      const data = dataObject.toJSON({
         withoutURIData: true,
         ignoreUnchanged: true,
         converters: { datetime: (ts: number) => ts / 1000 },
      })

      if (Object.keys(data).length === 0) {
         Backend.warn('[PGA] Nothing to update')
         return dataObject
      }

      const pgData = this._prepareData(data, true)

      let query = `UPDATE ${dataObject.uri.collection?.toLowerCase()} SET `
      let i = 1
      Object.keys(dataObject.properties).forEach((key) => {
         const prop = dataObject.get(key)
         if (prop.hasChanged === true) {
            query += `${i > 1 ? ', ' : ''}${key.toLowerCase()} = `
            if (prop.constructor.name === 'DateTimeProperty') {
               query += `to_timestamp($${i})`
            } else {
               query += `$${i}`
            }
            i++
         }
      })

      query += ` WHERE id = '${dataObject.uid}'`

      Backend.debug(`[PGA] ${query}`)
      Backend.debug(`[PGA] Values ${JSON.stringify(pgData)}`)

      await (await this._connect()).query(query, pgData)

      return dataObject
   }

   async delete(
      dataObject: DataObjectClass<any>,
      hardDelete = false
   ): Promise<DataObjectClass<any>> {
      if (dataObject.uid === undefined) {
         throw new BackendError('Dataobject has no uid')
      }

      // execute middlewares
      await this.executeMiddlewares(dataObject, BackendAction.DELETE, {
         useDateFormat: true,
      })

      await this._connect()

      if (!hardDelete) {
         dataObject.set('status', statuses.DELETED)
         let query = `UPDATE ${dataObject.uri.collection} SET status = $1 WHERE id = $2`
         await this._connection?.query(query, [
            statuses.DELETED,
            dataObject.uid,
         ])
      } else {
         await this._connection?.query(
            `DELETE FROM ${dataObject.uri.collection} WHERE id = $1`,
            [dataObject.uid]
         )
      }

      dataObject.uri = new ObjectUri()

      return dataObject
   }

   async deleteCollection(collection: string, batchSize = 500): Promise<void> {
      Backend.log(`Deleting all records from collection '${collection}'`)
      await this._connect()
      await this._connection?.query(`TRUNCATE TABLE ${collection}`)
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
               `[PGA] Can't find collection matching object to query`
            )
         }

         Backend.debug(`[PGA] Preparing query on '${collection}'`)

         let hasFilters = false
         const alias = 'coll'
         const query: string[] = []
         const fields: string[] = [`${alias}.id`]
         const caseMap = {}

         query.push(`SELECT * FROM ${collection.toLowerCase()} AS coll`)

         // prepare joins
         Object.keys(dataObject.properties).forEach((prop) => {
            const lcProp = `${prop.toLowerCase()}`
            Reflect.set(caseMap, lcProp, prop)
            if (
               dataObject.properties[prop].constructor.name ===
                  'ObjectProperty' &&
               dataObject.properties[prop].instanceOf
            ) {
               Backend.debug(
                  `Adding join table for property ${prop} instance of ${dataObject.properties[prop].instanceOf}`
               )

               const joinAlias = `${prop.toLowerCase()}_table`

               const table =
                  this._params.mapping &&
                  this._params.mapping[dataObject.properties[prop].instanceOf]
                     ? this._params.mapping[
                          dataObject.properties[prop].instanceOf
                       ]
                     : dataObject.properties[prop].instanceOf.COLLECTION

               query.push(
                  `LEFT JOIN ${table} AS ${joinAlias} ON ${joinAlias}.id = coll.${prop.toLowerCase()}`
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
               let realProp: any = filter.prop
               let realOperator: string
               let realValue = filter.value
               if (filter.prop === 'keywords') {
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
               } else if (
                  filter.prop !== AbstractBackendAdapter.PKEY_IDENTIFIER &&
                  !dataObject.has(filter.prop)
               ) {
                  throw new BackendError(
                     `[PGA] No such property '${filter.prop}' on object'`
                  )
               } else if (
                  filter.prop === AbstractBackendAdapter.PKEY_IDENTIFIER
               ) {
                  realProp = 'id'
                  realOperator = operatorsMap[filter.operator]
               } else {
                  const property = dataObject.get(filter.prop)

                  if (property.constructor.name === 'ObjectProperty') {
                     if (filter.value instanceof ObjectUri) {
                        realValue = filter.value.path
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
                  query.push(
                     `${
                        filter.prop === 'keywords' ? '' : `${alias}.`
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

         const connection = await this._connect()
         const countSnapshot = await connection.query(
            `${query.join(' ').replace('*', 'COUNT(*) as total')}`
         )

         Backend.info(`[PGA] Counting records ${countSnapshot.rows[0].total}`)

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

         const result = await connection.query(`${literal}`)

         const meta: QueryMetaType = {
            count: parseInt(countSnapshot.rows[0].total),
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
}
