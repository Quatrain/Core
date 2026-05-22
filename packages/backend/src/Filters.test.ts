import { Filter } from './Filter'
import { Filters } from './Filters'

describe('Filter and Filters', () => {
   it('should instantiate Filter with default operator', () => {
      const filter = new Filter('name', 'John')
      expect(filter.prop).toBe('name')
      expect(filter.value).toBe('John')
      expect(filter.operator).toBe('equals')
   })

   it('should instantiate Filter with custom operator', () => {
      const filter = new Filter('age', 18, 'greater')
      expect(filter.prop).toBe('age')
      expect(filter.value).toBe(18)
      expect(filter.operator).toBe('greater')
   })

   it('should instantiate Filters with or/and logic', () => {
      const f1 = new Filter('name', 'John')
      const f2 = new Filter('age', 18, 'greater')
      const filters = new Filters([f1], [f2])
      
      expect(filters.or).toBeDefined()
      expect(filters.or?.[0]).toBe(f1)
      expect(filters.and).toBeDefined()
      expect(filters.and?.[0]).toBe(f2)
   })

   it('should instantiate Filters without arguments', () => {
      const filters = new Filters()
      expect(filters.or).toBeUndefined()
      expect(filters.and).toBeUndefined()
   })
})
