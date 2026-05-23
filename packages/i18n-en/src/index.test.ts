import { enDictionary } from './index'

describe('enDictionary', () => {
   it('should contain english table translation keys', () => {
      expect(enDictionary.table.uid).toBe('Identifier')
      expect(enDictionary.table.searchPlaceholder).toBe('Search...')
   })

   it('should contain english statuses translations', () => {
      expect(enDictionary.statuses?.active).toBe('Active')
      expect(enDictionary.statuses?.draft).toBe('Draft')
      expect(enDictionary.statuses?.zipping).toBe('Archiving')
   })
})

