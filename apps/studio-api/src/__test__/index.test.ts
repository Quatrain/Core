import { HistoryMiddleware } from '../middlewares/HistoryMiddleware'
import { BackendAction, Backend } from '@quatrain/backend'
import { seedContainer } from '../scripts/seed-container'
import { startStudioApi } from '../index'

// Mock SQLiteAdapter to prevent real db connection
jest.mock('@quatrain/backend-sqlite', () => {
   return {
      SQLiteAdapter: jest.fn().mockImplementation(() => {
         return {
            query: jest.fn()
         }
      })
   }
})

// Mock MigrationManager
jest.mock('@quatrain/backend-migrations', () => {
   return {
      MigrationManager: jest.fn().mockImplementation(() => {
         return {
            executeMigrations: jest.fn().mockResolvedValue(true)
         }
      })
   }
})

// Mock ExpressAdapter
jest.mock('@quatrain/api-server-express', () => {
   return {
      ExpressAdapter: jest.fn().mockImplementation(() => {
         return {
            disable: jest.fn(),
            use: jest.fn(),
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
            addMiddleware: jest.fn(),
            serveStatic: jest.fn(),
            createRouter: jest.fn(),
            addEndpoint: jest.fn(),
            start: jest.fn().mockImplementation((port, callback) => {
               if (callback) callback()
            })
         }
      })
   }
})

jest.mock('@quatrain/studio', () => {
   const actual = jest.requireActual('@quatrain/studio')
   const mockHistoryInstance = {
      set: jest.fn(),
      save: jest.fn().mockResolvedValue(true)
   }
   const mockBackendInstance = {
      set: jest.fn(),
      save: jest.fn().mockResolvedValue(true)
   }
   const mockStorageInstance = {
      set: jest.fn(),
      save: jest.fn().mockResolvedValue(true)
   }
   return {
      ...actual,
      StudioHistory: {
         factory: jest.fn().mockResolvedValue(mockHistoryInstance),
         fromBackend: jest.fn()
      },
      StudioBackend: {
         factory: jest.fn().mockResolvedValue(mockBackendInstance),
         query: jest.fn().mockReturnValue({
            execute: jest.fn().mockResolvedValue({
               meta: { count: 0 },
               items: []
            })
         }),
         fromBackend: jest.fn()
      },
      StudioStorage: {
         factory: jest.fn().mockResolvedValue(mockStorageInstance),
         query: jest.fn(),
         fromBackend: jest.fn()
      },
      _mockHistoryInstance: mockHistoryInstance,
      _mockBackendInstance: mockBackendInstance,
      _mockStorageInstance: mockStorageInstance
   }
})

// Retrieve the mocked instances
const { 
   StudioHistory, 
   StudioBackend, 
   StudioStorage, 
   _mockHistoryInstance: mockHistoryInstance,
   _mockBackendInstance: mockBackendInstance,
   _mockStorageInstance: mockStorageInstance
} = require('@quatrain/studio')

describe('HistoryMiddleware', () => {
   beforeEach(() => {
      jest.clearAllMocks()
   })

   it('should prevent logging for StudioHistory or studio_history', async () => {
      const middleware = new HistoryMiddleware()
      const mockDataObject = {
         uri: { class: { name: 'StudioHistory' } },
         has: jest.fn(),
         val: jest.fn()
      } as any

      await middleware.afterExecute(mockDataObject, BackendAction.CREATE)
      expect(StudioHistory.factory).not.toHaveBeenCalled()
   })

   it('should log action and entity info for regular objects', async () => {
      const middleware = new HistoryMiddleware()
      const mockDataObject = {
         uri: { class: { name: 'StudioModel' } },
         uid: 'mock-uid',
         has: jest.fn().mockReturnValue(true),
         val: jest.fn().mockImplementation((key) => {
            if (key === 'name') return 'TestModel'
            return null
         })
      } as any

      await middleware.afterExecute(mockDataObject, BackendAction.CREATE)

      expect(StudioHistory.factory).toHaveBeenCalled()
      expect(mockHistoryInstance.set).toHaveBeenCalledWith('action', 'CREATE')
      expect(mockHistoryInstance.set).toHaveBeenCalledWith('entityType', 'StudioModel')
      expect(mockHistoryInstance.set).toHaveBeenCalledWith('entity', 'mock-uid')
      expect(mockHistoryInstance.set).toHaveBeenCalledWith('entityName', 'TestModel')
      expect(mockHistoryInstance.save).toHaveBeenCalled()
   })

   it('should handle deletion actions correctly', async () => {
      const middleware = new HistoryMiddleware()
      const mockDataObject = {
         uri: { collection: 'studio_project' },
         uid: 'proj-1',
         has: jest.fn().mockImplementation((key) => key === 'status'),
         val: jest.fn().mockImplementation((key) => {
            if (key === 'status') return 'deleted'
            return null
         })
      } as any

      await middleware.afterExecute(mockDataObject, BackendAction.UPDATE)

      expect(StudioHistory.factory).toHaveBeenCalled()
      expect(mockHistoryInstance.set).toHaveBeenCalledWith('action', 'DELETE')
      expect(mockHistoryInstance.set).toHaveBeenCalledWith('entityType', 'studio_project')
   })

   it('should log errors inside HistoryMiddleware gracefully without throwing', async () => {
      const middleware = new HistoryMiddleware()
      const mockDataObject = {
         uri: null, // Causes TypeError inside afterExecute
         has: jest.fn(),
         val: jest.fn()
      } as any

      const errorSpy = jest.spyOn(Backend, 'error').mockImplementation(() => {})

      await expect(middleware.afterExecute(mockDataObject, BackendAction.CREATE)).resolves.not.toThrow()
      expect(errorSpy).toHaveBeenCalled()
      errorSpy.mockRestore()
   })
})

describe('seedContainer', () => {
   beforeEach(() => {
      jest.clearAllMocks()
   })

   it('should seed data when backend count is 0', async () => {
      await seedContainer()
      expect(StudioBackend.factory).toHaveBeenCalled()
      expect(mockBackendInstance.set).toHaveBeenCalledWith('name', 'Local SQLite')
      expect(StudioStorage.factory).toHaveBeenCalled()
      expect(mockStorageInstance.set).toHaveBeenCalledWith('name', 'Local Storage')
   })

   it('should skip seeding when backend count is greater than 0', async () => {
      const queryMock = StudioBackend.query as jest.Mock
      queryMock.mockReturnValue({
         execute: jest.fn().mockResolvedValue({
            meta: { count: 1 },
            items: [mockBackendInstance]
         })
      })

      await seedContainer()
      expect(StudioBackend.factory).not.toHaveBeenCalled()
      expect(StudioStorage.factory).not.toHaveBeenCalled()
   })
})

describe('startStudioApi', () => {
   beforeEach(() => {
      jest.clearAllMocks()
   })

   it('should run server startup process cleanly', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { return undefined as never })
      await startStudioApi()
      expect(exitSpy).not.toHaveBeenCalled()
      exitSpy.mockRestore()
   })
})
