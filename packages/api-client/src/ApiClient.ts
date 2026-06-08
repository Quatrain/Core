import { Log } from '@quatrain/log'
import { AuthProvider } from './auth/AuthProvider'

export interface RestApi {
   client: any
   params: object
}

export enum Method {
   GET = 'GET',
   POST = 'POST',
   PATCH = 'PATCH',
   PUT = 'PUT',
   DELETE = 'DELETE',
}

export type QueryOptions = {
   url?: string
   debug?: boolean
   batch?: number
   offset?: number
   where?: object
   headers?: Record<string, string>
   responseType?: string
   [key: string]: any
}

export type SelectValuesOptions = {
   url?: string
   offset?: number
   fsort?: string
   batch?: number
   fullId?: boolean
   debug?: boolean
}

type ApiPayload = {
   status: number
   data: any | any[]
   meta: object
}

const apiInstances: Record<string, ApiClient> = {}

/**
 * Universal isomorphic REST API Client for making structured requests 
 * towards a Quatrain backend or other standard REST APIs.
 */
export class ApiClient implements RestApi {
   /** Controls detailed logging of the requests. */
   static debug: boolean = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'

   /** Default instance name. */
   static DEFAULT: string = 'default'
   /** Default base URL prefix. */
   static DEFAULT_URL: string = ''
   /** Default API endpoint path. */
   static DEFAULT_ENDPOINT: string = 'api'
   
   // Cache configuration (Stubs only for now)
   /** Cache status flag. */
   static CACHE_ACTIVE = true
   /** Default cache TTL in seconds. */
   static CACHE_TTL: number = 60 * 60
   /** Magic string indicating cache eviction. */
   static CACHE_REMOVE: string = '__force_cache_removal__'

   /**
    * Retrieves or creates a named singleton instance of the ApiClient.
    * 
    * @param url - Optional base URL.
    * @param name - Instance name.
    * @returns The ApiClient instance.
    */
   static instance(url: string | null = null, name: string = ApiClient.DEFAULT): ApiClient {
      return apiInstances[name] || new ApiClient(url)
   }

   // Cache stubs
   /**
    * Cache data access method (currently a stub).
    * 
    * @param key - The cache key.
    * @param data - The data payload to store, or a signal to remove.
    * @returns The stored data or false.
    */
   static cache(key: string, data: any = undefined): any {
      if (data) {
         if (data === ApiClient.CACHE_REMOVE) {
            ApiClient.invalidate(key)
         }
         return data
      }
      return false
   }

   /**
    * Generates a unique cache key based on the endpoint and query options.
    * 
    * @param endpoint - The API endpoint.
    * @param options - Additional query configurations.
    * @returns A string cache key.
    */
   static getCacheKey(endpoint: string, options: any = null): string {
      // Hash is stubbed out for now, return a basic key
      return `api-${endpoint}|${options ? JSON.stringify(options) : ''}`
   }

   /**
    * Invalidates all cache entries starting with a specific prefix.
    * 
    * @param _prefix - The prefix string to invalidate.
    */
   static invalidate(_prefix: string): void {
      // Stub
   }

   /** Instance specific debug flag. */
   public debug = false
   /** Default request query parameters/options. */
   public params: QueryOptions = {}
   /** Native HTTP client / wrapper. */
   public client: any
   private baseURL: string
   private authProvider?: AuthProvider

   constructor(url: string | null, name: string = ApiClient.DEFAULT, authProvider?: AuthProvider) {
      this.baseURL = url || `${ApiClient.DEFAULT_URL}${ApiClient.DEFAULT_ENDPOINT}`
      this.authProvider = authProvider
      
      this.params = {
         offset: 0,
         batch: 10,
      }

      apiInstances[name] = this
   }

   /**
    * Injects an authentication provider strategy.
    * 
    * @param authProvider - An AuthProvider implementation.
    */
   public setAuthProvider(authProvider: AuthProvider) {
      this.authProvider = authProvider
   }

   /**
    * Performs an HTTP POST request.
    * 
    * @param endpoint - The API path.
    * @param payload - The body data.
    * @returns The API response payload.
    */
   public async post(endpoint: string, payload: object) {
      return this.query(endpoint, Method.POST, payload)
   }

   /**
    * Performs an HTTP PATCH request.
    * 
    * @param endpoint - The API path.
    * @param payload - The delta body data.
    * @returns The API response payload.
    */
   public async patch(endpoint: string, payload: object) {
      return this.query(endpoint, Method.PATCH, payload)
   }

   /**
    * Performs an HTTP PUT request.
    * 
    * @param endpoint - The API path.
    * @param payload - The body data.
    * @returns The API response payload.
    */
   public async put(endpoint: string, payload: object) {
      return this.query(endpoint, Method.PUT, payload)
   }

   /**
    * Performs an HTTP GET request.
    * 
    * @param endpoint - The API path.
    * @param params - Query parameters.
    * @returns The API response payload.
    */
   public async get(endpoint: string, params: QueryOptions = {}) {
      return this.query(endpoint, Method.GET, {}, params)
   }

   /**
    * Performs an HTTP DELETE request.
    * 
    * @param endpoint - The API path.
    * @param payload - Optional body data for the delete request.
    * @returns The API response payload.
    */
   public async delete(endpoint: string, payload: object) {
      return this.query(endpoint, Method.DELETE, payload)
   }

   /**
    * Unified query dispatcher.
    * 
    * @param url - The target endpoint.
    * @param method - The HTTP verb.
    * @param payload - The body content.
    * @param params - Additional query strings and headers.
    * @returns A constructed Quatrain API response payload.
    */
   public async query(
      url: string,
      method: Method = Method.GET,
      payload: object = {},
      params: QueryOptions = {}
   ): Promise<ApiPayload> {
      if (method !== Method.GET) {
         ApiClient.cache(ApiClient.getCacheKey(url, params).split('|')[0], ApiClient.CACHE_REMOVE)
      }

      const fullUrl = (url.startsWith('http') ? url : `${this.baseURL}/${url.startsWith('/') ? url.substring(1) : url}`).replace(/([^:]\/)\/+/g, "$1")
      
      // Construct URL search params if provided
      let finalUrl = fullUrl
      if (method === Method.GET && Object.keys(params).length > 0) {
         const searchParams = new URLSearchParams()
         for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
               searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
            }
         }
         const qs = searchParams.toString()
         if (qs) {
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs
         }
      }

      if (method === Method.GET) {
         Log.debug(`[ApiClient] GET ${url}`)
      } else {
         Log.debug(`[ApiClient] Mutation ${method} on ${url}`)
      }

      const headers: Record<string, string> = {
         'Content-Type': 'application/json',
         ...params.headers
      }

      if (this.authProvider) {
         const authHeaders = await this.authProvider.getHeaders()
         Object.assign(headers, authHeaders)
      }

      const init: RequestInit = {
         method,
         headers,
      }

      if (method !== Method.GET && method !== Method.DELETE && payload) {
         init.body = JSON.stringify(payload)
      }

      try {
         const response = await fetch(finalUrl, init)
         return this.buildReturn(response, { method, url: finalUrl }, params)
      } catch (err: any) {
         return this.buildError(err)
      }
   }

   protected buildError(error: any): never {
      console.debug('\\tQuery Error:', error)
      throw error
   }

   protected async buildReturn(response: Response, config: any, _params: QueryOptions): Promise<ApiPayload> {
      const payload: ApiPayload = {
         status: response.status,
         data: [],
         meta: {},
      }

      if (!response.ok) {
         let errorMessage = `API Error: ${response.status} ${response.statusText}`
         try {
            const errorData: any = await response.json()
            if (errorData.error) {
               errorMessage = errorData.error
               if (errorData.message) {
                  errorMessage += `: ${errorData.message}`
               }
            } else if (errorData.message) {
               errorMessage = errorData.message
            }
         } catch (e) {
            // Ignore parse errors
         }
         throw new Error(errorMessage)
      }

      let data: any = null
      if (response.status !== 204 && response.status !== 205) {
         const text = await response.text()
         if (text && text.trim().length > 0) {
            data = JSON.parse(text)
         }
      }

      if (ApiClient.debug === true) {
         console.log(`API: [${response.status}] ${config.method.toUpperCase()} ${config.url}`)
      }

      if (data) {
         const { results, items } = data
         payload.data = this.preparePayload(results || items || data)
         if (data.meta) {
            payload.meta = { ...data.meta }
         }
      }

      return payload
   }

   protected preparePayload(payload: any): any {
      if (Array.isArray(payload)) {
         return payload.map(({ objectId, uid, ...others }) => ({
            uid: objectId || uid,
            ...others,
         }))
      } else if (typeof payload === 'object' && payload !== null) {
         const { objectId, uid, ...others } = payload
         return { ...others, ...(objectId || uid ? { uid: objectId || uid } : {}) }
      }
      return payload
   }
}
