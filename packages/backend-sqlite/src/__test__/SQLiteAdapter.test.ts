import { User } from '@quatrain/backend'
import { BackendError, Filter, OperatorKeys } from '@quatrain/backend'
import { NotFoundError } from '@quatrain/core'
import { SQLiteAdapter } from '../SQLiteAdapter'
import { createUser, createEntity, setup, Entity } from './common'
import fs from 'fs'
import path from 'path'

describe('SQLiteAdapter Tests', () => {
   let adapter: SQLiteAdapter
   let user: User
   let entity: Entity
   const testDbPath = path.join(__dirname, 'test.db')

   beforeAll(async () => {
      // Clean up any existing test database
      if (fs.existsSync(testDbPath)) {
         fs.unlinkSync(testDbPath)
      }
      
      adapter = setup()

      // Create test data
      user = await createUser()
      await adapter.create(user.dataObject, undefined)

      entity = await createEntity()
      await adapter.create(entity.dataObject, undefined)
   })

   afterAll(async () => {
      try {
         await adapter.deleteCollection('user')
         await adapter.deleteCollection('entities')
         await adapter.close()
         
         // Clean up test database file
         if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath)
         }
      } catch (err) {
         // Ignore cleanup errors
      }
   })

   describe('Initialization', () => {
      test('should create SQLiteAdapter instance', () => {
         expect(adapter).toBeInstanceOf(SQLiteAdapter)
      })

      test('should create adapter with file database', () => {
         const fileAdapter = new SQLiteAdapter({
            config: { database: testDbPath }
         })
         expect(fileAdapter).toBeInstanceOf(SQLiteAdapter)
      })

      test('should default to in-memory database', () => {
         const defaultAdapter = new SQLiteAdapter()
         expect(defaultAdapter).toBeInstanceOf(SQLiteAdapter)
      })
   })

   describe('Data Processing Methods', () => {
      test('should handle array to string conversion', () => {
         const testArray = ['value1', 'value2', 'value3']
         const result = (adapter as any)._array2String(testArray)
         expect(result).toBe('\'["value1","value2","value3"]\'')
      })

      test('should handle empty array conversion', () => {
         const result = (adapter as any)._array2String([])
         expect(result).toBe('\'[]\'')
      })

      test('should handle mixed type array', () => {
         const result = (adapter as any)._array2String(['string', 123, true])
         expect(result).toBe('\'["string",123,true]\'')
      })
   })

   describe('Data Preparation', () => {
      test('should filter null values when filterNulls is true', () => {
         const data = {
            name: 'Test',
            description: null,
            value: '',
            count: 42
         }
         const result = (adapter as any)._prepareData(data, true)
         expect(result).toEqual(['Test', 42])
      })

      test('should include null values when filterNulls is false', () => {
         const data = {
            name: 'Test',
            description: null,
            value: '',
            count: 42
         }
         const result = (adapter as any)._prepareData(data, false)
         expect(result).toEqual(['Test', null, '', 42])
      })

      test('should handle arrays in data', () => {
         const data = {
            name: 'Test',
            tags: ['tag1', 'tag2']
         }
         const result = (adapter as any)._prepareData(data, false)
         expect(result).toEqual(['Test', '["tag1","tag2"]'])
      })
   })

   describe('CRUD Operations', () => {
      test('should read a record by path', async () => {
         const readUser = await User.factory()
         readUser.dataObject.uri.path = user.dataObject.uri.path
         
         const result = await adapter.read(readUser.dataObject)
         expect(result.val('firstname')).toBe('John')
         expect(result.val('lastname')).toBe('Doe')
         expect(result.val('email')).toBe('john@doe.com')
      })

      test('should correctly map SQLite id column back to Quatrain uid property', async () => {
         const db = await (adapter as any)._connect()
         // Vérifier que la colonne id existe bien en base
         const rawData = await db.get(`SELECT id, firstname FROM user WHERE id = ?`, [user.uid])
         expect(rawData.id).toBeDefined()
         expect((rawData as any).uid).toBeUndefined() // SQLite ne stocke pas de colonne uid

         // Vérifier que l'adaptateur remonte bien la valeur dans la propriété uid
         const readUser = await User.factory()
         readUser.dataObject.uri.path = user.dataObject.uri.path
         const result = await adapter.read(readUser.dataObject)
         expect(result.uid).toBe(rawData.id)
      })

      test('should throw NotFoundError for non-existent record', async () => {
         const nonExistentUser = await User.factory()
         nonExistentUser.dataObject.uri.path = 'user/non-existent-id'
         
         await expect(adapter.read(nonExistentUser.dataObject)).rejects.toThrow(NotFoundError)
      })

      test('should update a record', async () => {
         user.dataObject.set('firstname', 'Jane')
         const result = await adapter.update(user.dataObject)
         
         expect(result.val('firstname')).toBe('Jane')
         
         // Verify in database
         const readUser = await User.factory()
         readUser.dataObject.uri.path = user.dataObject.uri.path
         await adapter.read(readUser.dataObject)
         expect(readUser.dataObject.val('firstname')).toBe('Jane')
      })

      test('should handle update with no changes', async () => {
         const result = await adapter.update(user.dataObject)
         expect(result).toBe(user.dataObject)
      })

      test('should throw error when updating object without UID', async () => {
         const newUser = await User.factory()
         await expect(adapter.update(newUser.dataObject)).rejects.toThrow()
      })

      test('should create a record with desired UID', async () => {
         const testEntity = await createEntity()
         testEntity._.name = 'Entity with Custom ID'
         const customUid = 'custom-test-id-123'
         
         const result = await adapter.create(testEntity.dataObject, customUid)
         expect(result.uid).toBe(customUid)
      })

      test('should throw error when deleting object without UID', async () => {
         const newUser = await User.factory()
         await expect(adapter.delete(newUser.dataObject)).rejects.toThrow(BackendError)
      })

      test('should soft delete a record', async () => {
         const entityToDelete = await createEntity()
         entityToDelete._.name = 'To Soft Delete'
         await adapter.create(entityToDelete.dataObject, undefined)
         
         await adapter.delete(entityToDelete.dataObject, false)
         expect(entityToDelete.dataObject.uri.path).toBe('')
      })

      test('should hard delete a record', async () => {
         const entityToDelete = await createEntity()
         entityToDelete._.name = 'To Hard Delete'
         await adapter.create(entityToDelete.dataObject, undefined)
         
         await adapter.delete(entityToDelete.dataObject, true)
         expect(entityToDelete.dataObject.uri.path).toBe('')
      })
   })

   describe('Search and Query Operations', () => {
      beforeAll(async () => {
         // Create additional test data for queries
         for (let i = 0; i < 5; i++) {
            const testUser = await User.factory()
            testUser._.firstname = `SearchUser${i}`
            testUser._.lastname = 'SearchTest'
            testUser._.email = `searchuser${i}@test.com`
            testUser._.password = 'password'
            await adapter.create(testUser.dataObject, undefined)
         }
      })

      test('should find records without filters', async () => {
         const searchUser = await User.factory()
         const result = await adapter.find(searchUser.dataObject)
         
         expect(result.items.length).toBeGreaterThan(0)
         expect(result.meta.count).toBeGreaterThan(0)
      })

      test('should find records with equals filter', async () => {
         const searchUser = await User.factory()
         const filters = [new Filter('firstname', 'SearchUser1', OperatorKeys.equals)]
         
         const result = await adapter.find(searchUser.dataObject, filters)
         expect(result.items.length).toBe(1)
         expect(result.items[0].val('firstname')).toBe('SearchUser1')
      })

      test('should find records with like filter (contains)', async () => {
         const searchUser = await User.factory()
         const filters = [new Filter('lastname', 'SearchTest', OperatorKeys.like)]
         
         const result = await adapter.find(searchUser.dataObject, filters)
         expect(result.items.length).toBeGreaterThan(1)
      })

      test('should find records with keywords filter', async () => {
         const searchUser = await User.factory()
         const filters = [new Filter('keywords', 'SearchTest', OperatorKeys.like)]
         
         const result = await adapter.find(searchUser.dataObject, filters)
         expect(result.items.length).toBeGreaterThan(0)
      })

      test('should handle pagination', async () => {
         const searchUser = await User.factory()
         const pagination = {
            limits: { batch: 2, offset: 0 },
            sortings: [{ prop: 'firstname', order: 'asc' as const }]
         }
         
         const result = await adapter.find(searchUser.dataObject, undefined, pagination)
         expect(result.items.length).toBeLessThanOrEqual(2)
         expect(result.meta.batch).toBe(2)
         expect(result.meta.offset).toBe(0)
      })

      test('should handle sorting', async () => {
         const searchUser = await User.factory()
         const filters = [new Filter('lastname', 'SearchTest', OperatorKeys.equals)]
         const pagination = {
            limits: { batch: 10, offset: 0 },
            sortings: [{ prop: 'firstname', order: 'desc' as const }]
         }
         
         const result = await adapter.find(searchUser.dataObject, filters, pagination)
         expect(result.items.length).toBeGreaterThan(1)
         
         // Check if sorted in descending order
         for (let i = 1; i < result.items.length; i++) {
            const prev = result.items[i-1].val('firstname')
            const curr = result.items[i].val('firstname')
            expect(prev >= curr).toBe(true)
         }
      })

      test('should throw error for invalid property filter', async () => {
         const searchUser = await User.factory()
         const filters = [new Filter('nonexistent', 'value', OperatorKeys.equals)]
         
         await expect(adapter.find(searchUser.dataObject, filters)).rejects.toThrow(BackendError)
      })

      test('should handle greater than filter', async () => {
         const searchUser = await User.factory()
         const filters = [new Filter('firstname', 'SearchUser1', OperatorKeys.greater)]
         
         const result = await adapter.find(searchUser.dataObject, filters)
         expect(result.items.length).toBeGreaterThan(0)
      })

      test('should handle not equals filter', async () => {
         const searchUser = await User.factory()
         const filters = [new Filter('firstname', 'SearchUser0', OperatorKeys.notEquals)]
         
         const result = await adapter.find(searchUser.dataObject, filters)
         expect(result.items.length).toBeGreaterThan(0)
         
         // Verify none of the results have firstname 'SearchUser0'
         result.items.forEach(item => {
            expect(item.val('firstname')).not.toBe('SearchUser0')
         })
      })
   })

   describe('Table Management', () => {
      test('should create table automatically for new collections', async () => {
         // Create a new type of object that doesn't exist yet
         const newUser = await User.factory()
         newUser._.firstname = 'Auto'
         newUser._.lastname = 'Table'
         newUser._.email = 'auto@table.com'
         newUser._.password = 'password'
         
         // This should automatically create the table
         const result = await adapter.create(newUser.dataObject, undefined)
         expect(result.uid).toBeDefined()
      })

      test('should handle table existence check', async () => {
         // Test _ensureTable method indirectly through operations
         const user = await User.factory()
         user._.firstname = 'Table'
         user._.lastname = 'Exists'
         user._.email = 'table@exists.com'
         user._.password = 'password'
         
         await adapter.create(user.dataObject, undefined)
         
         // Should work fine with existing table
         const result = await adapter.find(user.dataObject)
         expect(result.items.length).toBeGreaterThan(0)
      })
   })

   describe('Error Handling', () => {
      test('should handle invalid path format', async () => {
         const testUser = await User.factory()
         testUser.dataObject.uri.path = 'invalid/path/format/too/many/parts'
         
         await expect(adapter.read(testUser.dataObject)).rejects.toThrow(NotFoundError)
      })

      test('should handle missing collection', async () => {
         const testUser = await User.factory()
         // Force collection to be undefined
         Object.defineProperty(testUser.dataObject.uri, 'collection', {
            value: undefined,
            writable: true
         })
         
         await expect(adapter.create(testUser.dataObject, undefined)).rejects.toThrow(BackendError)
      })

      test('should handle creation of object that already has UID', async () => {
         const testUser = await User.factory()
         testUser.dataObject.uri.path = 'user/existing-id'
         
         await expect(adapter.create(testUser.dataObject, undefined)).rejects.toThrow(BackendError)
      })
   })

   describe('Collection Operations', () => {
      test('should delete entire collection', async () => {
         // Create a test entity
         const testEntity = await createEntity()
         testEntity._.name = 'Collection Test'
         await adapter.create(testEntity.dataObject, undefined)
         
         // Delete collection
         await adapter.deleteCollection('entities')
         
         // Verify collection is empty by trying to find records
         const result = await adapter.find(testEntity.dataObject)
         expect(result.items.length).toBe(0)
      })

      test('should handle deleting non-existent collection', async () => {
         // Should not throw error when deleting non-existent collection
         await expect(adapter.deleteCollection('nonexistent')).resolves.not.toThrow()
      })
   })

   describe('Complex Data Types', () => {
      test('should handle array properties', async () => {
         // This would require a model with array properties
         // For now, we'll test the data preparation methods
         const data = {
            tags: ['web', 'mobile', 'api'],
            categories: ['tech', 'business']
         }
         
         const prepared = (adapter as any)._prepareData(data, false)
         expect(prepared).toContain('["web","mobile","api"]')
         expect(prepared).toContain('["tech","business"]')
      })

      test('should handle object references', async () => {
         const testUser = await User.factory()
         testUser._.firstname = 'Ref'
         testUser._.lastname = 'Test'
         testUser._.email = 'ref@test.com'
         testUser._.password = 'password'
         testUser._.entity = entity
         
         const result = await adapter.create(testUser.dataObject, undefined)
         expect(result.uid).toBeDefined()
         
         // Read back and verify reference
         const readUser = await User.factory()
         readUser.dataObject.uri.path = result.uri.path
         const readResult = await adapter.read(readUser.dataObject)
         
         // The entity reference should be properly handled
         expect(readResult.val('entity')).toBeDefined()
      })
   })

   describe('Connection Management', () => {
      test('should close connection properly', async () => {
         const tempAdapter = setup()
         
         // Create a connection by doing an operation
         const user = await User.factory()
         await tempAdapter.create(user.dataObject, undefined)
         
         // Close connection
         await tempAdapter.close()
         
         // Should be able to close without error
         expect(true).toBe(true)
      })

      test('should handle multiple close calls', async () => {
         const tempAdapter = setup()
         
         await tempAdapter.close()
         await tempAdapter.close() // Should not throw
         
         expect(true).toBe(true)
      })
   })
})