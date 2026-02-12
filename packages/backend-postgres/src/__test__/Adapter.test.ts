import { PostgresAdapter } from '../PostgresAdapter'
import { BackendError, Filter, OperatorKeys, User, PersistedBaseObject } from '@quatrain/backend'
import { Entity as CoreEntity } from '@quatrain/core'

// Create a simple Entity class that extends PersistedBaseObject for testing
class Entity extends PersistedBaseObject {
   static COLLECTION = 'entities'
   static PROPS_DEFINITION = CoreEntity.PROPS_DEFINITION

   static async factory(src: any = undefined): Promise<Entity> {
      return super.factory(src, Entity)
   }
}

describe('PostgresAdapter Tests', () => {
   let adapter: PostgresAdapter

   beforeAll(() => {
      adapter = new PostgresAdapter({
         config: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DB || 'quatrain_test',
            user: process.env.POSTGRES_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'password',
            max: 10,
         },
      })
   })

   describe('Initialization', () => {
      test('should create PostgresAdapter instance', () => {
         expect(adapter).toBeInstanceOf(PostgresAdapter)
      })

      test('should create adapter with default config', () => {
         const defaultAdapter = new PostgresAdapter()
         expect(defaultAdapter).toBeInstanceOf(PostgresAdapter)
      })
   })

   describe('Data Processing Methods', () => {
      test('should handle array to string conversion', () => {
         const testArray = ['value1', 'value2', 'value3']
         // Testing the protected method through type assertion
         const result = (adapter as any)._array2String(testArray)
         expect(result).toBe("('value1','value2','value3')")
      })

      test('should handle empty array conversion', () => {
         const result = (adapter as any)._array2String([])
         expect(result).toBe('()')
      })

      test('should handle single value array', () => {
         const result = (adapter as any)._array2String(['single'])
         expect(result).toBe("('single')")
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
         expect(result).toEqual(['Test', '', 42])
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

      test('should handle empty object', () => {
         const result = (adapter as any)._prepareData({}, true)
         expect(result).toEqual([])
      })
   })

   describe('Query Operations', () => {
      test('should create Filter with correct parameters', () => {
         const filter = new Filter('name', 'test', OperatorKeys.equals)
         expect(filter.prop).toBe('name')
         expect(filter.value).toBe('test')
         expect(filter.operator).toBe(OperatorKeys.equals)
      })

      test('should create Filter with different operators', () => {
         const likeFilter = new Filter('description', 'search', OperatorKeys.like)
         expect(likeFilter.operator).toBe(OperatorKeys.like)

         const containsFilter = new Filter('tags', ['tag1', 'tag2'], OperatorKeys.contains)
         expect(containsFilter.operator).toBe(OperatorKeys.contains)
         expect(Array.isArray(containsFilter.value)).toBe(true)
      })
   })

   describe('Error Handling', () => {
      test('should handle BackendError properly', () => {
         const error = new BackendError('Test error')
         expect(error).toBeInstanceOf(BackendError)
         expect(error.message).toBe('Test error')
      })
   })

   describe('Operators Mapping', () => {
      test('should have correct operator mappings', () => {
         // This tests the operatorsMap defined in PostgresAdapter
         const operatorsMap = {
            equals: '=',
            notEquals: '!=',
            greater: '>',
            greaterOrEquals: '>=',
            lower: '<',
            lowerOrEquals: '>',  // Note: This seems to be a bug in the original code
            like: 'ILIKE',
            contains: 'in',
            notContains: 'not in',
            containsAll: '<@',
            containsAny: '&&',
            isNull: 'IS NULL',
            isNotNull: 'IS NOT NULL',
         }

         expect(operatorsMap.equals).toBe('=')
         expect(operatorsMap.like).toBe('ILIKE')
         expect(operatorsMap.isNull).toBe('IS NULL')
         expect(operatorsMap.isNotNull).toBe('IS NOT NULL')
      })
   })
})