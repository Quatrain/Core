import { ServerAdapter, ApiHandler, ApiRequest, ApiResponse, EndpointHandler, EndpointOptions, ApiMiddleware } from '@quatrain/api'

/**
 * Standard utility to parse an express-like path pattern (e.g. `/probes/:id`) 
 * into a RegExp and return the list of matched parameter names.
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
   public statusCode = 200
   public headers = new Headers()
   public body: any = null
   public isEnded = false
   private resolvePromise?: (res: Response) => void
   
   public promise = new Promise<Response>((resolve) => {
      this.resolvePromise = resolve
   })

   status(code: number): this {
      this.statusCode = code
      return this
   }

   json(data: any): void {
      this.headers.set('Content-Type', 'application/json')
      this.body = JSON.stringify(data)
      this.end()
   }

   send(data: string): void {
      if (!this.headers.has('Content-Type')) {
         this.headers.set('Content-Type', 'text/plain; charset=utf-8')
      }
      this.body = data
      this.end()
   }

   setHeader(name: string, value: string): void {
      this.headers.set(name, value)
   }

   write(data: string): void {
      if (this.body === null) {
         this.body = ''
      }
      this.body += data
   }

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

interface RegisteredRoute {
   method: string
   path: string
   regex: RegExp
   paramNames: string[]
   handler: ApiHandler
}

/**
 * Api Server adapter wrapping the Astro API environment.
 * Maps Quatrain's standardized `ServerAdapter` interfaces to web standards (Request/Response) used by Astro.
 */
export class AstroAdapter implements ServerAdapter {
   private routes: RegisteredRoute[] = []
   private middlewares: ApiMiddleware[] = []

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

   get(path: string, handler: ApiHandler): void {
      this.register('GET', path, handler)
   }

   post(path: string, handler: ApiHandler): void {
      this.register('POST', path, handler)
   }

   put(path: string, handler: ApiHandler): void {
      this.register('PUT', path, handler)
   }

   delete(path: string, handler: ApiHandler): void {
      this.register('DELETE', path, handler)
   }

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

   use(middleware: ApiMiddleware | any): void {
      if (typeof middleware === 'function') {
         this.middlewares.push(middleware)
      }
   }

   addMiddleware(middleware: ApiMiddleware): void {
      this.middlewares.push(middleware)
   }

   createRouter(path: string): ServerAdapter {
      const fullPrefix = (this.prefix + path).replace(/\/+/g, '/')
      return new AstroAdapter(fullPrefix, this.routes, this.middlewares)
   }

   start(port: number, callback?: () => void): void {
      console.warn("AstroAdapter starts automatically with the Astro dev server/hosting environment; start() is a stub.")
      if (callback) callback()
   }

   serveStatic(folderPath: string, apiPrefix?: string): void {
      console.warn("AstroAdapter: serveStatic is handled natively by Astro in the public/ folder or built assets.")
   }

   getNativeInstance(): any {
      return this
   }

   addEndpoint(handler: EndpointHandler, endpointRoot: string, options: EndpointOptions = {}): void {
      const router = this.createRouter(endpointRoot)
      if (options.middlewares && options.middlewares.length > 0) {
         options.middlewares.forEach((mw) => router.use(mw))
      }
      handler(router, '/', options)
   }

   /**
    * Static helper to wrap a single Quatrain ApiHandler into a native Astro APIRoute.
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
