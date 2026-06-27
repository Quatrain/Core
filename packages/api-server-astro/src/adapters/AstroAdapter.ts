import { ServerAdapter, ApiHandler, ApiRequest, ApiResponse, EndpointHandler, EndpointOptions, ApiMiddleware } from '@quatrain/api'

/**
 * Standard utility to parse an express-like path pattern (e.g. `/probes/:id`) 
 * into a RegExp and return the list of matched parameter names.
 * 
 * @param path - The route path pattern to translate.
 * @returns An object containing the compiled regex and the list of parameter names.
 */
function pathToRegex(path: string): { regex: RegExp; paramNames: string[] } {
   const paramNames: string[] = []
   
   // Normalize path: replace dynamic placeholders like ':id' with capture groups
   let cleanPath = path
   if (cleanPath.endsWith('/') && cleanPath !== '/') {
      cleanPath = cleanPath.slice(0, -1)
   }
   
   const pattern = cleanPath
      .replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
         paramNames.push(paramName)
         return '([^/]+)'
      })
      .replace(/\//g, '\\/')
   
   return {
      regex: new RegExp(`^${pattern}\\/?$`),
      paramNames
   }
}

/**
 * Records calls made to Quatrain's standard `ApiResponse` interface 
 * and resolves them into a standard web standard `Response` object.
 */
class AstroResponseRecorder implements ApiResponse {
   /** The HTTP status code of the response. */
   public statusCode = 200
   /** The headers mapping for the response. */
   public headers = new Headers()
   /** The body content payload. */
   public body: any = null
   /** Flag identifying whether the response stream has ended. */
   public isEnded = false
   /** Promise resolver callback for the native Response. */
   private resolvePromise?: (res: Response) => void
   
   /** Promise holding the translated Response instance. */
   public promise = new Promise<Response>((resolve) => {
      this.resolvePromise = resolve
   })

   /**
    * Sets the HTTP status code of the response.
    * 
    * @param code - The numeric HTTP status code.
    * @returns The current response recorder instance.
    */
   status(code: number): this {
      this.statusCode = code
      return this
   }

   /**
    * Sends a JSON response body.
    * 
    * @param data - The data payload to serialize.
    */
   json(data: any): void {
      this.headers.set('Content-Type', 'application/json')
      this.body = JSON.stringify(data)
      this.end()
   }

   /**
    * Sends a raw text response body.
    * 
    * @param data - The text string payload.
    */
   send(data: string): void {
      if (!this.headers.has('Content-Type')) {
         this.headers.set('Content-Type', 'text/plain; charset=utf-8')
      }
      this.body = data
      this.end()
   }

   /**
    * Sets a specific response header name and value.
    * 
    * @param name - The HTTP header key.
    * @param value - The HTTP header value.
    */
   setHeader(name: string, value: string): void {
      this.headers.set(name, value)
   }

   /**
    * Writes content chunk directly to the response body string.
    * 
    * @param data - The data chunk to append.
    */
   write(data: string): void {
      if (this.body === null) {
         this.body = ''
      }
      this.body += data
   }

   /**
    * Ends response recording and resolves the underlying native standard Response object.
    */
   end(): void {
      if (this.isEnded) return
      this.isEnded = true
      
      const response = new Response(this.body, {
         status: this.statusCode,
         headers: this.headers
      })
      this.resolvePromise?.(response)
   }
}

/**
 * Definition representing a registered route.
 */
interface RegisteredRoute {
   /** HTTP verb/method (e.g. 'GET', 'POST'). */
   method: string
   /** The standardized path string. */
   path: string
   /** The regex matching expression. */
   regex: RegExp
   /** The list of dynamic parameter keys. */
   paramNames: string[]
   /** The target Quatrain API handler function. */
   handler: ApiHandler
}

/**
 * Api Server adapter wrapping the Astro API environment.
 * Maps Quatrain's standardized `ServerAdapter` interfaces to web standards (Request/Response) used by Astro.
 */
export class AstroAdapter implements ServerAdapter {
   /** List of internal registered routes. */
   private routes: RegisteredRoute[] = []
   /** List of middleware routines. */
   private middlewares: ApiMiddleware[] = []

   /**
    * Instantiates a new AstroAdapter.
    * 
    * @param prefix - Prefix URL segment (e.g. '/api').
    * @param routesRef - Internal reference sharing existing routes list.
    * @param middlewaresRef - Internal reference sharing existing middlewares.
    */
   constructor(
      private prefix: string = '',
      routesRef?: RegisteredRoute[],
      middlewaresRef?: ApiMiddleware[]
   ) {
      if (routesRef) {
         this.routes = routesRef
      }
      if (middlewaresRef) {
         this.middlewares = middlewaresRef
      }
   }

   /**
    * Registers a handler for GET requests.
    * 
    * @param path - The relative routing path.
    * @param handler - The route handler execution logic.
    */
   get(path: string, handler: ApiHandler): void {
      this.register('GET', path, handler)
   }

   /**
    * Registers a handler for POST requests.
    * 
    * @param path - The relative routing path.
    * @param handler - The route handler execution logic.
    */
   post(path: string, handler: ApiHandler): void {
      this.register('POST', path, handler)
   }

   /**
    * Registers a handler for PUT requests.
    * 
    * @param path - The relative routing path.
    * @param handler - The route handler execution logic.
    */
   put(path: string, handler: ApiHandler): void {
      this.register('PUT', path, handler)
   }

   /**
    * Registers a handler for DELETE requests.
    * 
    * @param path - The relative routing path.
    * @param handler - The route handler execution logic.
    */
   delete(path: string, handler: ApiHandler): void {
      this.register('DELETE', path, handler)
   }

   /**
    * Registers a route configuration internally.
    * 
    * @param method - The HTTP verb.
    * @param path - The routing endpoint path.
    * @param handler - The route action handler.
    */
   private register(method: string, path: string, handler: ApiHandler): void {
      // Standardize the full path with the prefix
      const fullPath = (this.prefix + path).replace(/\/+/g, '/')
      const { regex, paramNames } = pathToRegex(fullPath)
      
      this.routes.push({
         method,
         path: fullPath,
         regex,
         paramNames,
         handler
      })
   }

   /**
    * Appends middleware routines to the router execution flow.
    * 
    * @param middleware - The middleware callback function.
    */
   use(middleware: ApiMiddleware | any): void {
      if (typeof middleware === 'function') {
         this.middlewares.push(middleware)
      }
   }

   /**
    * Appends a strict ApiMiddleware to the router execution flow.
    * 
    * @param middleware - The middleware callback function.
    */
   addMiddleware(middleware: ApiMiddleware): void {
      this.middlewares.push(middleware)
   }

   /**
    * Instantiates and returns a sub-router mapping to a nested prefix.
    * 
    * @param path - The nested sub-path segment prefix.
    * @returns A new ServerAdapter adapter instance bound to the prefix.
    */
   createRouter(path: string): ServerAdapter {
      const fullPrefix = (this.prefix + path).replace(/\/+/g, '/')
      return new AstroAdapter(fullPrefix, this.routes, this.middlewares)
   }

   /**
    * Stub starting the server environment (handled natively by Astro).
    * 
    * @param port - Target port.
    * @param callback - Optional completion routine.
    */
   start(port: number, callback?: () => void): void {
      console.warn("AstroAdapter starts automatically with the Astro dev server/hosting environment; start() is a stub.")
      if (callback) callback()
   }

   /**
    * Stub serving static files (handled natively by Astro).
    * 
    * @param folderPath - Public filesystem directory.
    * @param apiPrefix - Endpoint segment prefix.
    */
   serveStatic(folderPath: string, apiPrefix?: string): void {
      console.warn("AstroAdapter: serveStatic is handled natively by Astro in the public/ folder or built assets.")
   }

   /**
    * Returns the underlying router or runtime handler container.
    * 
    * @returns AstroAdapter instance itself.
    */
   getNativeInstance(): any {
      return this
   }

   /**
    * Registers a modular sub-endpoint namespace.
    * 
    * @param handler - The endpoints builder method.
    * @param endpointRoot - The route mapping context prefix.
    * @param options - Additional router options.
    */
   addEndpoint(handler: EndpointHandler, endpointRoot: string, options: EndpointOptions = {}): void {
      const router = this.createRouter(endpointRoot)
      if (options.middlewares && options.middlewares.length > 0) {
         options.middlewares.forEach((mw) => router.use(mw))
      }
      handler(router, '/', options)
   }

   /**
    * Static helper to wrap a single Quatrain ApiHandler into a native Astro APIRoute.
    * 
    * @param handler - The Quatrain API action handler.
    * @returns The wrapped Astro APIRoute execution callback.
    */
   static wrap(handler: ApiHandler): any {
      return async (context: any): Promise<Response> => {
         const { request, params, url } = context
         
         const headers: Record<string, string> = {}
         request.headers.forEach((value: string, key: string) => {
            headers[key] = value
         })

         let body: any = null
         const contentType = request.headers.get('content-type') || ''
         if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
            try {
               if (contentType.includes('application/json')) {
                  body = await request.clone().json()
               } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
                  const formData = await request.clone().formData()
                  body = Object.fromEntries(formData.entries())
               } else {
                  body = await request.clone().text()
               }
            } catch (e) {
               // Safe fallback if parsing fails
            }
         }

         const apiReq: ApiRequest & { locals?: any } = {
            body,
            params: params || {},
            query: Object.fromEntries(url.searchParams.entries()),
            headers,
            locals: context.locals
         }

         const apiRes = new AstroResponseRecorder()

         try {
            await handler(apiReq, apiRes)
            apiRes.end()
            return await apiRes.promise
         } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
               status: 500,
               headers: { 'Content-Type': 'application/json' }
            })
         }
      }
   }

   /**
    * Returns an Astro APIRoute handler that resolves dynamic catch-all route matching.
    * 
    * @returns The compiled Astro APIRoute handler.
    */
   public handle(): any {
      return async (context: any): Promise<Response> => {
         const { request, params: astroParams, url } = context
         const pathname = url.pathname
         const method = request.method

         // Find matching registered route
         let matchedRoute: RegisteredRoute | null = null
         let routeParams: Record<string, string> = {}

         for (const route of this.routes) {
            if (route.method !== method) continue
            
            const match = pathname.match(route.regex)
            if (match) {
               matchedRoute = route
               routeParams = {}
               route.paramNames.forEach((name, index) => {
                  routeParams[name] = decodeURIComponent(match[index + 1])
               })
               break
            }
         }

         if (!matchedRoute) {
            return new Response(JSON.stringify({ error: `Route not found: ${method} ${pathname}` }), {
               status: 404,
               headers: { 'Content-Type': 'application/json' }
            })
         }

         // Map standard headers
         const headers: Record<string, string> = {}
         request.headers.forEach((value: string, key: string) => {
            headers[key] = value
         })

         // Parse body securely
         let body: any = null
         const contentType = request.headers.get('content-type') || ''
         if (request.body && method !== 'GET' && method !== 'HEAD') {
            try {
               if (contentType.includes('application/json')) {
                  body = await request.clone().json()
               } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
                  const formData = await request.clone().formData()
                  body = Object.fromEntries(formData.entries())
               } else {
                  body = await request.clone().text()
               }
            } catch (e) {
               // Safe fallback
            }
         }

         const apiReq: ApiRequest & { locals?: any } = {
            body,
            params: { ...astroParams, ...routeParams },
            query: Object.fromEntries(url.searchParams.entries()),
            headers,
            locals: context.locals
         }

         const apiRes = new AstroResponseRecorder()

         try {
            let shouldContinue = true
            for (const mw of this.middlewares) {
               const res = await mw(apiReq, apiRes)
               if (res === false || apiRes.isEnded) {
                  shouldContinue = false
                  break
               }
            }

            if (shouldContinue) {
               await matchedRoute.handler(apiReq, apiRes)
            }

            apiRes.end()
            return await apiRes.promise
         } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
               status: 500,
               headers: { 'Content-Type': 'application/json' }
            })
         }
      }
   }
}
