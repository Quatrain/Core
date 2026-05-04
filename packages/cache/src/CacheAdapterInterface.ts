export interface CacheAdapterInterface {
   get(key: string): Promise<string | null>
   getBuffer(key: string): Promise<Buffer | null>
   set(key: string, value: string | Buffer, ttlSeconds?: number): Promise<void>
   del(...keys: string[]): Promise<void>
   keys(pattern: string): Promise<string[]>
}
