import { AuthProvider } from './AuthProvider'

export class BearerAuthProvider implements AuthProvider {
   private token: string | (() => string | Promise<string>)

   constructor(token: string | (() => string | Promise<string>)) {
      this.token = token
   }

   public async getHeaders(): Promise<Record<string, string>> {
      const resolvedToken = typeof this.token === 'function' ? await this.token() : this.token
      return {
         Authorization: `Bearer ${resolvedToken}`,
      }
   }
}
