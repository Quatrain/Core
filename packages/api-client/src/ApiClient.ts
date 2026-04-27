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

export class ApiClient implements RestApi {
   static debug: boolean = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'

   static DEFAULT: string = 'default'
   static DEFAULT_URL: string = ''
   static DEFAULT_ENDPOINT: string = 'api'
   
   // Cache configuration (Stubs only for now)
   static CACHE_ACTIVE = true
   static CACHE_TTL: number = 60 * 60
   static CACHE_REMOVE: string = '__force_cache_removal__'

   static instance(url: string | null = null, name: string = ApiClient.DEFAULT): ApiClient {
      return apiInstances[name] || new ApiClient(url)
   }

   // Cache stubs
   static cache(key: string, data: any = undefined): any {
      if (data) {
         if (data === ApiClient.CACHE_REMOVE) {
            ApiClient.invalidate(key)
         }
         return data
      }
      return false
   }

   static getCacheKey(endpoint: string, options: any = null): string {
      // Hash is stubbed out for now, return a basic key
      return `api-${endpoint}|${options ? JSON.stringify(options) : ''}`
   }

   static invalidate(prefix: string): void {
      // Stub
   }

   public debug = false
   public params: QueryOptions = {}
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

   public setAuthProvider(authProvider: AuthProvider) {
      this.authProvider = authProvider
   }

   public async post(endpoint: string, payload: object) {
      return this.query(endpoint, Method.POST, payload)
   }

   public async patch(endpoint: string, payload: object) {
      return this.query(endpoint, Method.PATCH, payload)
   }

   public async put(endpoint: string, payload: object) {
      return this.query(endpoint, Method.PUT, payload)
   }

   public async get(endpoint: string, params: QueryOptions = {}) {
      return this.query(endpoint, Method.GET, {}, params)
   }

   public async delete(endpoint: string, payload: object) {
      return this.query(endpoint, Method.DELETE, payload)
   }

   public async query(
      url: string,
      method: Method = Method.GET,
      payload: object = {},
      params: QueryOptions = {}
   ): Promise<ApiPayload> {
      if (method !== Method.GET) {
         ApiClient.cache(ApiClient.getCacheKey(url, params).split('|')[0], ApiClient.CACHE_REMOVE)
      }

      const fullUrl = url.startsWith('http') ? url : `${this.baseURL}/${url.startsWith('/') ? url.substring(1) : url}`
      
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

   protected async buildReturn(response: Response, config: any, params: QueryOptions): Promise<ApiPayload> {
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

      const data: any = await response.json()

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
