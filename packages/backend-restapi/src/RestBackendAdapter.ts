import {
   AbstractBackendAdapter,
   BackendAction,
   BackendError,
   DataObjectClass,
   Filters,
   Filter,
   QueryResultType,
   SchemaDelta,
   SortAndLimit
} from '@quatrain/backend'
import { ApiClient, AuthProvider } from '@quatrain/api-client'
import { Log } from '@quatrain/log'

export type QuerySerializer = (filters: Filters | Filter[] | undefined, pagination: SortAndLimit | undefined) => Record<string, any>

export interface RestAdapterOptions {
   baseUrl: string
   endpointMap?: Record<string, string> // e.g. { 'User': '/users' }
   allowedMethods?: BackendAction[] // e.g. ['read', 'find', 'create', 'update', 'delete']
   authProvider?: AuthProvider
   querySerializer?: QuerySerializer
}

/**
 * Backend adapter implementation bridging Quatrain's DataObjects to an external REST API.
 * Maps CRUD operations to standard HTTP methods (POST, GET, PATCH, DELETE).
 */
export class RestBackendAdapter extends AbstractBackendAdapter {
   /**
    * Executes a DELETE request targeting an entire collection endpoint.
    * 
    * @param collection - The collection name mapping to the target API endpoint.
    * @returns A promise resolving upon successful deletion.
    * @throws {BackendError} If the DELETE action is not permitted.
    */
   async deleteCollection(collection: string): Promise<void> {
      this.checkMethodAllowed(BackendAction.DELETE)
      const client = this.getClient()
      const url = this.buildUrl(collection)
      await client.delete(url, {})
   }
   protected baseUrl: string
   protected endpointMap: Record<string, string>
   protected allowedMethods: BackendAction[]
   protected authProvider?: AuthProvider
   protected querySerializer?: QuerySerializer

   constructor(options: RestAdapterOptions) {
      super()
      this.baseUrl = options.baseUrl
      this.endpointMap = options.endpointMap || {}
      this.allowedMethods = options.allowedMethods || [BackendAction.CREATE, BackendAction.READ, BackendAction.UPDATE, BackendAction.DELETE, 'find' as BackendAction]
      this.authProvider = options.authProvider
      this.querySerializer = options.querySerializer
   }

   protected checkMethodAllowed(method: BackendAction) {
      if (!this.allowedMethods.includes(method)) {
         throw new BackendError(`Method ${method} is not allowed on this REST API.`)
      }
   }

   protected buildUrl(collectionName: string, uid?: string): string {
      const path = this.endpointMap[collectionName] || `/${collectionName.toLowerCase()}`
      return uid ? `${path}/${uid}` : path
   }

   protected serializeQuery(filters: Filters | Filter[] | undefined, pagination: SortAndLimit | undefined): Record<string, any> {
      if (this.querySerializer) {
         return this.querySerializer(filters, pagination)
      }
      
      // Default basic serializer
      const params: Record<string, any> = {}
      if (pagination && pagination.limits) {
         if (pagination.limits.batch) params['limit'] = pagination.limits.batch
         if (pagination.limits.offset) params['offset'] = pagination.limits.offset
      }
      return params
   }

   protected getClient(): ApiClient {
      const client = ApiClient.instance(this.baseUrl)
      if (this.authProvider) {
         client.setAuthProvider(this.authProvider)
      }
      return client
   }

   /**
    * Performs an HTTP POST request to create a new resource on the remote API.
    * 
    * @param dataObject - The DataObject payload to serialize and transmit.
    * @param desiredUid - Ignored by REST (usually assigned by the remote API).
    * @returns A promise resolving to the data object populated with the API response UID.
    */
   async create(dataObject: DataObjectClass<any>, desiredUid?: string): Promise<DataObjectClass<any>> {
      this.checkMethodAllowed(BackendAction.CREATE)
      const client = this.getClient()
      const url = this.buildUrl(dataObject.uri.collection as string)
      
      await this.executeMiddlewares(dataObject, BackendAction.CREATE, 'before')

      const payload = await dataObject.toJSON()
      const response = await client.post(url, payload)
      
      if (response.data && response.data.uid) {
         dataObject.uid = response.data.uid
      }
      
      await this.executeMiddlewares(dataObject, BackendAction.CREATE, 'after')
      return dataObject
   }

   /**
    * Performs an HTTP GET request to retrieve a specific resource by its UID.
    * 
    * @param dataObject - The empty DataObject containing the collection and UID.
    * @returns A promise resolving to the populated DataObject.
    */
   async read(dataObject: DataObjectClass<any>): Promise<DataObjectClass<any>> {
      this.checkMethodAllowed(BackendAction.READ)
      const client = this.getClient()
      const url = this.buildUrl(dataObject.uri.collection as string, dataObject.uid)
      
      const response = await client.get(url)
      if (response.data) {
         dataObject.populate(response.data)
      }
      
      await this.executeMiddlewares(dataObject, BackendAction.READ, 'after')
      return dataObject
   }

   /**
    * Performs an HTTP PATCH request to update an existing remote resource.
    * 
    * @param dataObject - The DataObject payload containing the modified data.
    * @returns A promise resolving to the updated DataObject.
    */
   async update(dataObject: DataObjectClass<any>): Promise<DataObjectClass<any>> {
      this.checkMethodAllowed(BackendAction.UPDATE)
      const client = this.getClient()
      const url = this.buildUrl(dataObject.uri.collection as string, dataObject.uid)
      
      await this.executeMiddlewares(dataObject, BackendAction.UPDATE, 'before')

      const payload = await dataObject.toJSON()
      await client.patch(url, payload)
      
      await this.executeMiddlewares(dataObject, BackendAction.UPDATE, 'after')
      return dataObject
   }

   /**
    * Performs an HTTP DELETE request to remove a specific resource from the API.
    * 
    * @param dataObject - The DataObject referencing the resource to delete.
    * @returns A promise resolving upon successful deletion.
    */
   async delete(dataObject: DataObjectClass<any>): Promise<DataObjectClass<any>> {
      this.checkMethodAllowed(BackendAction.DELETE)
      const client = this.getClient()
      const url = this.buildUrl(dataObject.uri.collection as string, dataObject.uid)
      
      await this.executeMiddlewares(dataObject, BackendAction.DELETE, 'before')

      await client.delete(url, {})
      
      await this.executeMiddlewares(dataObject, BackendAction.DELETE, 'after')
      return dataObject
   }

   /**
    * Performs an HTTP GET request to query a collection endpoint.
    * Serializes filters and pagination into URL query parameters.
    * 
    * @param dataObject - The template DataObject defining the collection.
    * @param filters - Active search filters.
    * @param pagination - Limits and batch offsets.
    * @param parent - Optional parent context for nested endpoints.
    * @returns A promise resolving to an array of populated DataObjects and metadata.
    */
   async find(
      dataObject: DataObjectClass<any>,
      filters: Filters | Filter[] | undefined,
      pagination: SortAndLimit | undefined,
      parent: any
   ): Promise<QueryResultType<any>> {
      this.checkMethodAllowed('find' as BackendAction) // 'find' is technically not in BackendAction enum but is a method
      const client = this.getClient()
      const url = this.buildUrl(dataObject.uri.collection as string)
      
      const params = this.serializeQuery(filters, pagination)
      
      const response = await client.get(url, params)
      const items = Array.isArray(response.data) ? response.data : [response.data]
      
      return {
         items: items.map((item: Record<string, any>) => {
            const instance = Reflect.construct(dataObject.constructor, [])
            instance.populate(item)
            return instance
         }),
         meta: {
            count: (response.meta as any)?.total || items.length,
            offset: pagination?.limits?.offset || 0,
            batch: pagination?.limits?.batch || items.length,
            executionTime: 0
         }
      }
   }

   /**
    * Generates raw SQL for creating a table.
    * @throws {BackendError} Always throws because REST APIs do not support local schema generation.
    */
   generateCreateSql(collection: string, properties: any[]): { upSql: string; downSql: string } {
      throw new BackendError('generateCreateSql is not supported on REST API adapter')
   }

   /**
    * Generates raw SQL for altering a table schema.
    * @throws {BackendError} Always throws because REST APIs do not support local schema deltas.
    */
   generateDeltaSql(collection: string, delta: SchemaDelta): { upSql: string[]; downSql: string[] } {
      throw new BackendError('generateDeltaSql is not supported on REST API adapter')
   }
}
