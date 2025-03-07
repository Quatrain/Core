import { User } from '@quatrain/core'

export interface AuthInterface {
   register(user: User): Promise<any>

   signup(login: string, password: string): Promise<any>

   signout(user: User): Promise<any>

   update(user: User, updatable: any): Promise<any>

   delete(user: User): Promise<any>

   getAuthToken(token: string): any

   refreshToken(refreshToken: string): Promise<any>
}
