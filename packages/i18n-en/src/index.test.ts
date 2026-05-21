import { enDictionary } from './index'

describe('enDictionary', () => {
   it('should contain english table translation keys', () => {
      expect(enDictionary.table.uid).toBe('Identifier')
      expect(enDictionary.table.searchPlaceholder).toBe('Search...')
   })
})
