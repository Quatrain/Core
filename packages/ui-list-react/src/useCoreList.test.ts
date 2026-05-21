import * as React from 'react'
import { useCoreList } from './useCoreList'
import { CoreListManager, ListState } from '@quatrain/ui-list'

// Mock react hooks to execute synchronously without a full React renderer context
jest.mock('react', () => {
   const mockSetState = jest.fn()
   let currentState: any = null

   return {
      __esModule: true,
      ...jest.requireActual('react'),
      useMemo: jest.fn((fn) => fn()),
      useState: jest.fn((init) => {
         if (currentState === null) {
            currentState = typeof init === 'function' ? init() : init
         }
         return [currentState, mockSetState]
      }),
      useEffect: jest.fn((fn) => {
         const cleanup = fn()
         if (typeof cleanup === 'function') {
            cleanup()
         }
      }),
      // Store reference to trigger state updates in tests
      _mockSetState: mockSetState,
      _resetMockState: () => {
         currentState = null
         mockSetState.mockReset()
      }
   }
})

describe('useCoreList Hook', () => {
   const mockOptions = {
      endpoint: 'users',
      initialPage: 1,
      initialPageSize: 20,
      fetchFunction: jest.fn().mockResolvedValue({ items: [], meta: { count: 0 } })
   }

   beforeEach(() => {
      const mockReact = require('react') as any
      mockReact._resetMockState()
      mockOptions.fetchFunction.mockClear()
   })

   it('should initialize the hook, subscribe to manager, initialize and return state & bound operations', () => {
      const initSpy = jest.spyOn(CoreListManager.prototype, 'init').mockResolvedValue()
      const subscribeSpy = jest.spyOn(CoreListManager.prototype, 'subscribe').mockReturnValue(() => {})
      const setPageSpy = jest.spyOn(CoreListManager.prototype, 'setPage').mockImplementation(() => {})
      const setPageSizeSpy = jest.spyOn(CoreListManager.prototype, 'setPageSize').mockImplementation(() => {})
      const setSortingSpy = jest.spyOn(CoreListManager.prototype, 'setSorting').mockImplementation(() => {})
      const setFiltersSpy = jest.spyOn(CoreListManager.prototype, 'setFilters').mockImplementation(() => {})
      const querySpy = jest.spyOn(CoreListManager.prototype, 'query').mockResolvedValue()

      const result = useCoreList(mockOptions)

      expect(React.useMemo).toHaveBeenCalled()
      expect(React.useState).toHaveBeenCalled()
      expect(React.useEffect).toHaveBeenCalled()

      expect(subscribeSpy).toHaveBeenCalled()
      expect(initSpy).toHaveBeenCalled()

      expect(result.state).toEqual({
         items: [],
         meta: {},
         relationOptions: {},
         status: 'idle',
         error: null,
         page: 1,
         pageSize: 20,
         sorting: null,
         filters: {}
      })

      expect(result.manager).toBeInstanceOf(CoreListManager)

      // Test bound functions
      result.setPage(2)
      expect(setPageSpy).toHaveBeenCalledWith(2)

      result.setPageSize(50)
      expect(setPageSizeSpy).toHaveBeenCalledWith(50)

      result.setSorting({ field: 'name', order: 'asc' })
      expect(setSortingSpy).toHaveBeenCalledWith({ field: 'name', order: 'asc' })

      result.setFilters({ active: true })
      expect(setFiltersSpy).toHaveBeenCalledWith({ active: true })

      result.reload()
      expect(querySpy).toHaveBeenCalled()

      initSpy.mockRestore()
      subscribeSpy.mockRestore()
      setPageSpy.mockRestore()
      setPageSizeSpy.mockRestore()
      setSortingSpy.mockRestore()
      setFiltersSpy.mockRestore()
      querySpy.mockRestore()
   })

   it('should forward state updates via subscribe listener to state hook setter', () => {
      const mockReact = require('react') as any
      let subscribeCallback: any = null

      jest.spyOn(CoreListManager.prototype, 'subscribe').mockImplementation((cb: any) => {
         subscribeCallback = cb
         return () => {}
      })
      jest.spyOn(CoreListManager.prototype, 'init').mockResolvedValue()

      useCoreList(mockOptions)

      expect(subscribeCallback).toBeDefined()
      const testState: ListState = {
         items: [{ uid: 'u1', name: 'User' }],
         meta: { count: 1 },
         relationOptions: {},
         status: 'idle',
         error: null,
         page: 1,
         pageSize: 20,
         sorting: null,
         filters: {}
      }

      subscribeCallback(testState)
      expect(mockReact._mockSetState).toHaveBeenCalledWith(testState)
   })
})
