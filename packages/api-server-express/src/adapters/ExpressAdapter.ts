import express from 'express'
import { ServerAdapter, ApiHandler, ApiRequest, ApiResponse, EndpointHandler, EndpointOptions, ApiMiddleware } from '@quatrain/api'

/**
 * Api Server adapter wrapping the `express` framework.
 * Maps Quatrain's standardized `ServerAdapter` interfaces to native Express mechanisms.
 */
export class ExpressAdapter implements ServerAdapter {
   constructor(
      private appOrRouter: express.Application | express.Router = express(),
      private config: { apiPrefix?: string } = {}
   ) {
      if ('listen' in this.appOrRouter && typeof this.appOrRouter.listen === 'function') {
         // Default global middlewares for top-level application
         (this.appOrRouter as express.Application).disable('x-powered-by')
         this.appOrRouter.use(express.json())
         this.appOrRouter.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*')
            res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS')
            res.header('Access-Control-Allow-Headers', '*')
            if (req.method === 'OPTIONS') {
               return res.sendStatus(200)
            }
            next()
         })
      }
   }

   /**
    * Maps Express native request and response objects into Quatrain-standardized
    * ApiRequest and ApiResponse wrappers while preserving native stream and response methods.
    * 
    * @param req - Native Express request.
    * @param res - Native Express response.
    * @returns Object containing standardized apiReq and apiRes instances.
    */
   private mapRequestResponse(req: express.Request, res: express.Response): { apiReq: ApiRequest; apiRes: ApiResponse } {
      const apiReq: ApiRequest = Object.assign(req, {
         body: req.body,
         params: req.params,
         query: req.query,
         headers: req.headers as Record<string, string | string[] | undefined>
      })

      const apiRes: ApiResponse = res

      return { apiReq, apiRes }
   }

   /**
    * Wraps a standard Quatrain ApiHandler into an Express RequestHandler middleware,
    * forwarding any thrown asynchronous errors to Express's next() error handler.
    * 
    * @param handler - The Quatrain ApiHandler to wrap.
    * @returns An Express RequestHandler function.
    */
   private wrapHandler(handler: ApiHandler): express.RequestHandler {
      return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
         void (async () => {
            const { apiReq, apiRes } = this.mapRequestResponse(req, res)
            await handler(apiReq, apiRes)
         })().catch(next)
      }
   }

   /**
    * Normalizes a handler argument into an Express RequestHandler.
    * Preserves native Express error/middleware handlers having 3 or more arguments,
    * and wraps standard 2-argument Quatrain ApiHandlers.
    * 
    * @param handler - The handler function or middleware.
    * @returns A compatible Express RequestHandler.
    */
   private normalizeHandler(handler: any): express.RequestHandler {
      if (typeof handler === 'function' && handler.length >= 3) {
         return handler
      }
      return this.wrapHandler(handler)
   }

   /**
    * Registers a GET endpoint.
    * 
    * @param path - The URI path.
    * @param handlers - Standard Quatrain ApiHandlers or native Express middlewares.
    */
   get(path: string, ...handlers: (ApiHandler | any)[]): void {
      const wrapped = handlers.map(h => this.normalizeHandler(h))
      ;(this.appOrRouter as express.Router).get(path, ...wrapped)
   }

   /**
    * Registers a POST endpoint.
    * 
    * @param path - The URI path.
    * @param handlers - Standard Quatrain ApiHandlers or native Express middlewares.
    */
   post(path: string, ...handlers: (ApiHandler | any)[]): void {
      const wrapped = handlers.map(h => this.normalizeHandler(h))
      ;(this.appOrRouter as express.Router).post(path, ...wrapped)
   }

   /**
    * Registers a PUT endpoint.
    * 
    * @param path - The URI path.
    * @param handlers - Standard Quatrain ApiHandlers or native Express middlewares.
    */
   put(path: string, ...handlers: (ApiHandler | any)[]): void {
      const wrapped = handlers.map(h => this.normalizeHandler(h))
      ;(this.appOrRouter as express.Router).put(path, ...wrapped)
   }

   /**
    * Registers a PATCH endpoint.
    * 
    * @param path - The URI path.
    * @param handlers - Standard Quatrain ApiHandlers or native Express middlewares.
    */
   patch(path: string, ...handlers: (ApiHandler | any)[]): void {
      const wrapped = handlers.map(h => this.normalizeHandler(h))
      ;(this.appOrRouter as express.Router).patch(path, ...wrapped)
   }

   /**
    * Registers a DELETE endpoint.
    * 
    * @param path - The URI path.
    * @param handlers - Standard Quatrain ApiHandlers or native Express middlewares.
    */
   delete(path: string, ...handlers: (ApiHandler | any)[]): void {
      const wrapped = handlers.map(h => this.normalizeHandler(h))
      ;(this.appOrRouter as express.Router).delete(path, ...wrapped)
   }

   /**
    * Attaches a native Express middleware, path prefix, or sub-router.
    * 
    * @param args - Arguments forwarded directly to express.use (e.g. path and RequestHandlers).
    */
   use(...args: any[]): void {
      ;(this.appOrRouter as any).use(...args)
   }

   /**
    * Injects a Quatrain-compatible API middleware into the flow.
    * 
    * @param middleware - The Quatrain ApiMiddleware function.
    */
   addMiddleware(middleware: ApiMiddleware): void {
      const expressMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
         void (async () => {
            const { apiReq, apiRes } = this.mapRequestResponse(req, res)
            const shouldContinue = await middleware(apiReq, apiRes)
            if (shouldContinue) {
               next()
            }
         })().catch(next)
      }
      (this.appOrRouter as express.Router).use(expressMiddleware)
   }

   /**
    * Spawns an isolated routing scope (sub-router).
    * 
    * @param path - The prefix path for the router.
    * @returns A new ExpressAdapter instance controlling the sub-router.
    */
   createRouter(path: string): ServerAdapter {
      const router = express.Router()
      ;(this.appOrRouter as express.Router).use(path, router)
      return new ExpressAdapter(router)
   }

   /**
    * Binds the server to the network and starts listening.
    * 
    * @param port - The network port.
    * @param callback - Optional completion callback.
    */
   start(port: number, callback?: () => void): void {
      if ('listen' in this.appOrRouter && typeof this.appOrRouter.listen === 'function') {
         this.appOrRouter.listen(port, callback)
      } else {
         throw new Error("Cannot start a server on a Router instance.")
      }
   }

   /**
    * Retrieves the underlying native framework instance.
    * 
    * @returns The raw Express Application or Router instance.
    */
   getNativeInstance(): any {
      return this.appOrRouter
   }

   /**
    * Configures the server to serve static files from a specified folder.
    * It also sets up a fallback route for SPA (Single Page Application) navigation,
    * ensuring that non-API routes return the main index.html file.
    * 
    * @param folderPath The absolute path to the directory containing static files (e.g. built frontend).
    * @param apiPrefix The prefix used for API routes, which will be ignored by the SPA fallback. Defaults to '/api'.
    */
   serveStatic(folderPath: string, apiPrefix: string = '/api'): void {
      const path = require('node:path')
      this.use(express.static(folderPath))
      
      ;(this.appOrRouter as express.Router).get('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
         if (req.path.startsWith(apiPrefix)) return next()
         res.sendFile(path.join(folderPath, 'index.html'))
      })
   }

   /**
    * Composes and mounts a full EndpointHandler block at a specific root.
    * 
    * @param handler - The endpoint initialization logic.
    * @param endpointRoot - The base URI.
    * @param options - Middlewares and operational options.
    */
   addEndpoint(handler: EndpointHandler, endpointRoot: string, options: EndpointOptions = {}): void {
      const fullPath = this.config.apiPrefix ? `${this.config.apiPrefix}${endpointRoot}` : endpointRoot
      const router = this.createRouter(fullPath)
      
      if (options.middlewares && options.middlewares.length > 0) {
         options.middlewares.forEach((mw) => router.use(mw))
      }
      
      handler(router, '/', options)
   }
}
