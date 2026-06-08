export interface ApiRequest {
   body: any
   params: Record<string, string>
   query: Record<string, any>
   headers?: Record<string, string | string[] | undefined>
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
export type ApiMiddleware = (req: ApiRequest, res: ApiResponse) => Promise<boolean> | boolean
