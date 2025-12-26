import { Query } from './Query'
import { PersistedBaseObject } from './PersistedBaseObject'
import { Filter } from './Filter'
import { OperatorKeys } from './types/OperatorsKeys'

class MockObject extends PersistedBaseObject {
   static COLLECTION = 'mock'
}

describe('Query Builder', () => {
   it('should initialize with an object class', () => {
      const query = new Query(MockObject)
      expect(query.obj).toBe(MockObject)
      expect(query.filters).toHaveLength(0)
   })

   it('should add filters using where()', () => {
      const query = new Query(MockObject)
      query.where('name', 'test')
      expect(query.filters).toHaveLength(1)
      expect(query.filters[0]).toBeInstanceOf(Filter)
      expect(query.filters[0].prop).toBe('name')
      expect(query.filters[0].value).toBe('test')
   })

   it('should handle operator in where()', () => {
      const query = new Query(MockObject)
      query.where('age', 18, OperatorKeys.greaterOrEquals)
      expect(query.filters[0].operator).toBe(OperatorKeys.greaterOrEquals)
   })

   it('should set limits', () => {
      const query = new Query(MockObject)
      query.batch(5).offset(10)
      expect(query.limits.batch).toBe(5)
      expect(query.limits.offset).toBe(10)
   })
})
