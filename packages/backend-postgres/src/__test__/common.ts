import { PostgresAdapter } from '../PostgresAdapter'
export { Entity, createUser, createEntity, createUsers } from '@quatrain/testing'

export const setup = () => {
   return new PostgresAdapter({
      config: {
         host: process.env.POSTGRES_HOST || 'localhost',
         port: parseInt(process.env.POSTGRES_PORT || '5432'),
         database: process.env.POSTGRES_DB || 'quatrain_test',
         user: process.env.POSTGRES_USER || 'postgres',
         password: process.env.POSTGRES_PASSWORD || 'password',
         max: 10,
      },
   })
}
