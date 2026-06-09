import { esDictionary } from './index'

describe('esDictionary', () => {
   it('should contain Spanish table translation keys', () => {
      expect(esDictionary.table.uid).toBe('Identificador')
      expect(esDictionary.table.searchPlaceholder).toBe('Buscar...')
   })

   it('should contain Spanish statuses translations', () => {
      expect(esDictionary.statuses?.active).toBe('Activo')
      expect(esDictionary.statuses?.draft).toBe('Borrador')
      expect(esDictionary.statuses?.zipping).toBe('Archivando')
   })
})
