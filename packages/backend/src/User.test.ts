import { Backend } from './Backend'
import { MockAdapter } from './MockAdapter'
import { User } from './User'
import { UserRepository } from './UserRepository'
import { NotFoundError } from '@quatrain/core'

describe('User & UserRepository', () => {
   beforeAll(() => {
      Backend.addBackend(new MockAdapter(), 'default', true)
   })

   it('should instantiate a User and get values', async () => {
      const user = await User.factory({
         name: 'John Doe',
         firstname: 'John',
         lastname: 'Doe',
         email: 'john@example.com',
         password: 'hashedpassword'
      })

      expect(user).toBeInstanceOf(User)
      expect(user.val('name')).toBe('John Doe')
      expect(user.val('email')).toBe('john@example.com')
   })

   it('should fetch User from email using UserRepository', async () => {
      const repo = new UserRepository()
      
      // Attempt to retrieve a non-existent email
      await expect(repo.getFromEmail('missing@example.com')).rejects.toThrow(NotFoundError)

      // Create and save a user
      const user = await User.factory({
         name: 'Jane Doe',
         firstname: 'Jane',
         lastname: 'Doe',
         email: 'jane@example.com',
         password: 'jane-password'
      })
      await user.save()

      // Retrieve via repository
      const fetched = await repo.getFromEmail('jane@example.com')
      expect(fetched).toBeDefined()
      expect(fetched.val('name')).toBe('Jane Doe')
      expect(fetched.val('email')).toBe('jane@example.com')
   })
})
