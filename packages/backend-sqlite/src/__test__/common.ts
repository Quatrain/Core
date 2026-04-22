import { SQLiteAdapter } from '../SQLiteAdapter'
export { Entity, createUser, createEntity, createUsers } from '@quatrain/testing'

export const setup = (dbPath: string = ':memory:') => {
   return new SQLiteAdapter({
      config: {
         database: dbPath
      },
   })
}