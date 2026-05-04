import { AuthProvider } from './AuthProvider'

export class BasicAuthProvider implements AuthProvider {
   private token: string

   constructor(username: string, password?: string) {
      if (password !== undefined) {
         // Create base64 token if both are provided
         this.token = Buffer.from(`${username}:${password}`).toString('base64')
      } else {
         // Assume the username argument is already the base64 token
         this.token = username
      }
   }

   public async getHeaders(): Promise<Record<string, string>> {
      return {
         Authorization: `Basic ${this.token}`,
      }
   }
}
