import { frDictionary } from './index'

describe('frDictionary', () => {
   it('should contain french table translation keys', () => {
      expect(frDictionary.table.uid).toBe('Identifiant')
      expect(frDictionary.table.searchPlaceholder).toBe('Rechercher...')
   })
})
