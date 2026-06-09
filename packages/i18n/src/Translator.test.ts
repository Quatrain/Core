import { Translator } from './Translator'
import { QuatrainDictionary } from './types'

describe('Translator', () => {
   let translator: Translator

   const mockEnDict: QuatrainDictionary = {
      table: {
         uid: 'UID',
         id: 'ID',
         status: 'Status',
         createdAt: 'Created At',
         createdBy: 'Created By',
         updatedAt: 'Updated At',
         updatedBy: 'Updated By',
         deletedAt: 'Deleted At',
         deletedBy: 'Deleted By',
         showMeta: 'Show Metadata',
         noData: 'No Data Available',
         rowsPerPage: 'Rows per page',
         searchPlaceholder: 'Search...',
         loading: 'Loading...'
      },
      app: {
         title: 'Core App',
         nested: {
            deep: 'Deep Value'
         }
      }
   }

   const mockFrDict: QuatrainDictionary = {
      table: {
         uid: 'UID',
         id: 'Identifiant',
         status: 'Statut',
         createdAt: 'Créé le',
         createdBy: 'Créé par',
         updatedAt: 'Mis à jour le',
         updatedBy: 'Mis à jour par',
         deletedAt: 'Supprimé le',
         deletedBy: 'Supprimé par',
         showMeta: 'Afficher les métadonnées',
         noData: 'Aucune donnée disponible',
         rowsPerPage: 'Lignes par page',
         searchPlaceholder: 'Rechercher...',
         loading: 'Chargement...'
      },
      app: {
         title: 'Application Core',
         nested: {
            deep: 'Valeur Profonde'
         }
      }
   }

   beforeEach(() => {
      translator = new Translator('en')
      translator.register('en', mockEnDict)
      translator.register('fr', mockFrDict)
   })

   it('should initialize with default language', () => {
      expect((translator as any).defaultLang).toBe('en')
   })

   it('should register multiple dictionaries in a single call', () => {
      const multiTranslator = new Translator('en')
      multiTranslator.register({
         en: mockEnDict,
         fr: mockFrDict,
      })
      expect(multiTranslator.translate('table', 'id')).toBe('ID')
      expect(multiTranslator.translate('table', 'id', 'fr')).toBe('Identifiant')
   })

   it('should translate using standard scope and key', () => {
      expect(translator.translate('table', 'id')).toBe('ID')
      expect(translator.translate('table', 'id', 'fr')).toBe('Identifiant')
   })

   it('should fallback to default language if target language dictionary is missing', () => {
      expect(translator.translate('table', 'id', 'es')).toBe('ID')
   })

   it('should support dotted path key resolution as the first argument', () => {
      expect(translator.translate('app.title')).toBe('Core App')
      expect(translator.translate('app.title', 'fr')).toBe('Application Core')
      expect(translator.translate('app.nested.deep')).toBe('Deep Value')
      expect(translator.translate('app.nested.deep', 'fr')).toBe('Valeur Profonde')
   })

   it('should support dotted key paths inside the second argument', () => {
      expect(translator.translate('app', 'nested.deep')).toBe('Deep Value')
      expect(translator.translate('app', 'nested.deep', 'fr')).toBe('Valeur Profonde')
   })

   it('should dynamically extend dictionaries at runtime using deepMerge', () => {
      const customEn = {
         app: {
            title: 'Custom Core App',
            subtitle: 'Powerful Monorepo'
         },
         newScope: {
            item: 'New Item'
         }
      }

      translator.extend('en', customEn)

      // Overwritten value
      expect(translator.translate('app.title')).toBe('Custom Core App')
      // Extended new value in existing scope
      expect(translator.translate('app.subtitle')).toBe('Powerful Monorepo')
      // Unaltered existing values
      expect(translator.translate('app.nested.deep')).toBe('Deep Value')
      // Extended value in completely new scope
      expect(translator.translate('newScope.item')).toBe('New Item')
   })

   it('should handle extend when dictionary is not yet registered', () => {
      const esTranslator = new Translator('es')
      esTranslator.extend('es', { app: { title: 'Aplicación' } })
      expect(esTranslator.translate('app.title')).toBe('Aplicación')
   })

   it('should return raw keys or fallbacks if a key or scope is not found', () => {
      expect(translator.translate('nonexistent.key')).toBe('key')
      expect(translator.translate('nonexistent.nested.key')).toBe('nested.key')
      expect(translator.translate('app.nonexistent')).toBe('nonexistent')
   })

   it('should handle translation request when no dictionaries are registered', () => {
      const emptyTranslator = new Translator('en')
      expect(emptyTranslator.translate('any.key')).toBe('key')
      expect(emptyTranslator.translate('scope', 'key')).toBe('key')
      expect(emptyTranslator.translate('scope')).toBe('scope') // resolvedKey is falsy and dict is missing
   })

   it('should return scope or resolvedKey if current is not a string', () => {
      expect(translator.translate('app')).toBe('app') // current is object, resolvedKey is undefined
      expect(translator.translate('app', 'nested')).toBe('nested') // current is object, resolvedKey is nested
   })

   it('should return target if source is null or undefined in extend', () => {
      const initialDict = (translator as any).dictionaries['en']
      translator.extend('en', null as any)
      expect((translator as any).dictionaries['en']).toEqual(initialDict)
   })
})
