import { DataObject, StringProperty } from '@quatrain/core'
import { InjectKeywordsMiddleware } from './InjectKeywordsMiddleware'
import { BackendAction } from '../Backend'

describe('InjectKeywordsMiddleware', () => {
   it('should generate keywords for string properties with fullSearch: true on CREATE', () => {
      const propDef = [
         { name: 'name', type: StringProperty.TYPE, fullSearch: true },
         { name: 'description', type: StringProperty.TYPE }
      ]
      const dao = DataObject.factory({ properties: propDef })
      dao.set('name', 'Hello World')
      dao.set('description', 'Unrelated text')

      const middleware = new InjectKeywordsMiddleware()
      middleware.beforeExecute(dao, BackendAction.CREATE)

      expect(dao.has('keywords')).toBe(true)
      const keywords = dao.val('keywords')
      expect(keywords).toBeDefined()
      // "hello" -> "he", "hel", "hell", "hello"
      // "world" -> "wo", "wor", "worl", "world"
      expect(keywords).toContain('he')
      expect(keywords).toContain('hel')
      expect(keywords).toContain('hell')
      expect(keywords).toContain('hello')
      expect(keywords).toContain('wo')
      expect(keywords).toContain('wor')
      expect(keywords).toContain('world')
      expect(keywords).not.toContain('unrelated')
   })

   it('should skip generating keywords on other actions like READ', () => {
      const propDef = [
         { name: 'name', type: StringProperty.TYPE, fullSearch: true }
      ]
      const dao = DataObject.factory({ properties: propDef })
      dao.set('name', 'Hello')

      const middleware = new InjectKeywordsMiddleware()
      middleware.beforeExecute(dao, BackendAction.READ)

      // The property structure is added by the middleware in beforeExecute,
      // but the values are only generated on CREATE/UPDATE.
      expect(dao.has('keywords')).toBe(true)
      expect(dao.val('keywords')).toBeUndefined()
   })
})
