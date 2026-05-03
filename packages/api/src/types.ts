export interface ApiRequest {
   body: any
   params: Record<string, string>
   query: Record<string, any>
}

export interface ApiResponse {
   status(code: number): this
   json(data: any): void
   send(data: string): void
   setHeader(name: string, value: string): void
   write(data: string): void
   end(): void
}

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<void> | void

export interface ServerAdapter {
   get(path: string, handler: ApiHandler): void
   post(path: string, handler: ApiHandler): void
   put(path: string, handler: ApiHandler): void
   delete(path: string, handler: ApiHandler): void
   
   use(middleware: any): void
   createRouter(path: string): ServerAdapter
   start(port: number, callback?: () => void): void
   getNativeInstance(): any

   addEndpoint(handler: EndpointHandler, endpointRoot: string, options?: EndpointOptions): void
}

export interface EndpointOptions {
   methods?: string[]
   middlewares?: any[]
}

export type EndpointHandler = (router: ServerAdapter, path: string, options: EndpointOptions) => void
