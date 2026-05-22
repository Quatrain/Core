import { DataObject, StringProperty, ObjectProperty } from '@quatrain/core'
import { InjectMetaMiddleware } from './InjectMetaMiddleware'
import { BackendAction } from '../Backend'

describe('InjectMetaMiddleware', () => {
   const schema = [
      { name: 'name', type: StringProperty.TYPE },
      { name: 'createdBy', type: ObjectProperty.TYPE },
      { name: 'createdAt', type: StringProperty.TYPE },
      { name: 'updatedBy', type: ObjectProperty.TYPE },
      { name: 'updatedAt', type: StringProperty.TYPE },
      { name: 'deletedBy', type: ObjectProperty.TYPE },
      { name: 'deletedAt', type: StringProperty.TYPE }
   ]

   it('should inject creation metadata on CREATE', async () => {
      const dao = DataObject.factory({ properties: schema })
      const mockUser = { email: 'creator@example.com' } as any
      const middleware = new InjectMetaMiddleware({ user: mockUser })

      middleware.beforeExecute(dao, BackendAction.CREATE, { useDateFormat: true })

      expect(dao.val('createdBy')).toBe(mockUser)
      expect(typeof dao.val('createdAt')).toBe('string')
      expect(dao.val('updatedBy')).toBeUndefined()
   })

   it('should inject update metadata on UPDATE', async () => {
      const dao = DataObject.factory({ properties: schema })
      const mockUser = { email: 'updater@example.com' } as any
      const middleware = new InjectMetaMiddleware({ user: mockUser })

      middleware.beforeExecute(dao, BackendAction.UPDATE)

      expect(dao.val('updatedBy')).toBe(mockUser)
      expect(typeof dao.val('updatedAt')).toBe('number')
      expect(dao.val('createdBy')).toBeUndefined()
   })

   it('should inject delete metadata on DELETE', async () => {
      const dao = DataObject.factory({ properties: schema })
      const mockUser = { email: 'deleter@example.com' } as any
      const middleware = new InjectMetaMiddleware({ user: mockUser })

      middleware.beforeExecute(dao, BackendAction.DELETE)

      expect(dao.val('deletedBy')).toBe(mockUser)
      expect(typeof dao.val('deletedAt')).toBe('number')
      expect(dao.val('createdBy')).toBeUndefined()
   })

   it('should skip metadata injection for unhandled actions', async () => {
      const dao = DataObject.factory({ properties: schema })
      const middleware = new InjectMetaMiddleware()

      middleware.beforeExecute(dao, BackendAction.READ)

      expect(dao.val('createdBy')).toBeUndefined()
      expect(dao.val('updatedBy')).toBeUndefined()
      expect(dao.val('deletedBy')).toBeUndefined()
   })
})
