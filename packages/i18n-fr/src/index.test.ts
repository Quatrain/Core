import { frDictionary } from './index'

describe('frDictionary', () => {
   it('should contain french table translation keys', () => {
      expect(frDictionary.table.uid).toBe('Identifiant')
      expect(frDictionary.table.searchPlaceholder).toBe('Rechercher...')
   })

   it('should contain french statuses translations', () => {
      expect(frDictionary.statuses?.active).toBe('Actif')
      expect(frDictionary.statuses?.draft).toBe('Brouillon')
      expect(frDictionary.statuses?.zipping).toBe('Archivage en cours')
   })
})

