import { Backend, User } from '@quatrain/backend'
import { Core } from '@quatrain/core'
import { Entity } from '@quatrain/testing'
import { PostgresAdapter } from '../PostgresAdapter'
export { Entity, createUser, createEntity, createUsers } from '@quatrain/testing'

Core.addClass('Entity', Entity)
// Every model refers to users (createdBy…): with the class registered, the adapter creates the
// complete users table whichever test runs first, instead of a bare placeholder.
Core.addClass('User', User)

export const setup = () => {
   Backend.addBackend(
      new PostgresAdapter({
         config: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: Number.parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DB || 'quatrain_test',
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'password',
            max: 10,
         },
      }),
      '@default',
      true
   )
   return Backend.getBackend()
}
