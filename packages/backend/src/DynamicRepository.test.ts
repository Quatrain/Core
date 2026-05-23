import { PersistedBaseObject } from './PersistedBaseObject'
import { BaseRepository } from './BaseRepository'
import { Repository } from './Repository'
import { Backend } from './Backend'
import { MockAdapter } from './MockAdapter'
import { StringProperty, NumberProperty } from '@quatrain/core'

class TestProduct extends PersistedBaseObject {
   static COLLECTION = 'products'
   static PROPS_DEFINITION = [
      { name: 'name', type: StringProperty.TYPE },
      { name: 'price', type: NumberProperty.TYPE },
   ]
}

class CustomProductRepository extends BaseRepository<CustomProduct> {
   getCustomGreeting() {
      return 'Hello'
   }
}

class CustomProduct extends PersistedBaseObject {
   static COLLECTION = 'custom_products'
   static PROPS_DEFINITION = [
      { name: 'title', type: StringProperty.TYPE },
   ]
   static REPOSITORY_CLASS = CustomProductRepository
}

class ExplicitProduct extends PersistedBaseObject {
   static COLLECTION = 'explicit_products'
}
class ExplicitRepository extends BaseRepository<ExplicitProduct> {}

describe('Dynamic Repository Abstraction', () => {
   beforeAll(() => {
      Backend.addBackend(new MockAdapter(), 'mock', true)
   })

   test('zero-boilerplate: Model.repository() dynamically generates and caches BaseRepository', () => {
      const repo = TestProduct.repository()
      expect(repo).toBeInstanceOf(BaseRepository)
      expect(TestProduct.repository()).toBe(repo) // Verify caching
   })

   test('performs CRUD operations on the dynamic repository', async () => {
      const repo = TestProduct.repository()
      
      // Create
      const product = await TestProduct.factory({ name: 'Laptop', price: 999 })
      const saved = await repo.create(product)
      expect(saved.dataObject.uid).toBeDefined()
      expect(saved.dataObject.val('name')).toBe('Laptop')

      // Read
      const retrieved = await repo.read(saved.dataObject.uid)
      expect(retrieved).toBeDefined()
      expect(retrieved.dataObject.val('name')).toBe('Laptop')
      
      // Update
      retrieved.dataObject.set('price', 899)
      const updated = await repo.update(retrieved)
      expect(updated.dataObject.val('price')).toBe(899)
      
      // Delete
      await repo.delete(saved.dataObject.uid, true)
      const deleted = await repo.read(saved.dataObject.uid)
      expect(deleted).toBeNull()
   })

   test('custom repository: Model.repository() instantiates custom repository class', () => {
      const repo = CustomProduct.repository()
      expect(repo).toBeInstanceOf(CustomProductRepository)
      expect((repo as CustomProductRepository).getCustomGreeting()).toBe('Hello')
   })

   test('registry: explicitly registers and retrieves custom repositories', () => {
      Repository.register(ExplicitProduct, ExplicitRepository)
      
      const repo = Repository.for(ExplicitProduct)
      expect(repo).toBeInstanceOf(ExplicitRepository)
      
      const contextRepo = new Repository()
      const resolved = contextRepo.getFor(ExplicitProduct)
      expect(resolved).toBeInstanceOf(ExplicitRepository)
   })
})
