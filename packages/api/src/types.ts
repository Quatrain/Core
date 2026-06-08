import { ApiRequest, ApiResponse, ApiHandler, ApiMiddleware } from '@quatrain/http'

export type { ApiRequest, ApiResponse, ApiHandler, ApiMiddleware }

export interface ServerAdapter {
   get(path: string, handler: ApiHandler): void
   post(path: string, handler: ApiHandler): void
   put(path: string, handler: ApiHandler): void
   delete(path: string, handler: ApiHandler): void
   
   use(middleware: ApiMiddleware | any): void
   addMiddleware?(middleware: ApiMiddleware): void
   createRouter(path: string): ServerAdapter
   start(port: number, callback?: () => void): void
   getNativeInstance(): any
   
   /**
    * Configures the server to serve static files from a specified folder.
    * Automatically handles fallback routing for Single Page Applications (SPA).
    * 
    * @param folderPath The absolute path to the directory containing static files.
    * @param apiPrefix The prefix used for API routes (ignored by SPA fallback).
    */
   serveStatic(folderPath: string, apiPrefix?: string): void

   addEndpoint(handler: EndpointHandler, endpointRoot: string, options?: EndpointOptions): void
}

export interface EndpointOptions {
   methods?: string[]
   middlewares?: any[]
}

export type EndpointHandler = (router: ServerAdapter, path: string, options: EndpointOptions) => void
