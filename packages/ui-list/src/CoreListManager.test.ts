import { CoreListManager, ListState } from './CoreListManager'

describe('CoreListManager', () => {
   let mockApiClient: any
   let mockSchema: any

   beforeEach(() => {
      mockApiClient = {
         get: jest.fn().mockImplementation((url: string) => {
            if (url.endsWith('/values')) {
               return Promise.resolve({
                  data: [
                     { value: '1', name: 'Entity One', _search: 'one' },
                     { value: '2', name: 'Entity Two', _search: 'two' }
                  ]
               })
            }
            return Promise.resolve({
               items: [{ uid: 'r1', name: 'Row 1', relationId: '1' }],
               meta: { count: 1 }
            })
         })
      }

      mockSchema = {
         name: 'TestModel',
         PROPS_DEFINITION: [
            {
               name: 'relationId',
               type: 'ObjectProperty',
               options: {
                  instanceOf: 'RelatedModel',
                  pattern: '${name} - Selected'
               }
            }
         ]
      }
   })

   it('should initialize with provided config and options', () => {
      const manager = new CoreListManager({
         config: { pagesize: 15 },
         modelSchema: mockSchema,
         initialPage: 2,
         initialPageSize: 25,
         initialSorting: { field: 'name', order: 'desc' },
         initialFilters: { search: 'test' }
      })

      const state = (manager as any).state
      expect(state.page).toBe(2)
      expect(state.pageSize).toBe(25)
      expect(state.sorting).toEqual({ field: 'name', order: 'desc' })
      expect(state.filters).toEqual({ search: 'test' })
      expect(manager.getConfig().endpoint).toBe('testmodels')
   })

   it('should load config from decorator listClass if specified', () => {
      const decoratorConfig = { endpoint: 'custom-endpoint', pagesize: 12 }
      class DecoratedClass {
         static listConfig = decoratorConfig
      }

      const manager = new CoreListManager({
         listClass: DecoratedClass
      })

      expect(manager.getConfig().endpoint).toBe('custom-endpoint')
      expect((manager as any).state.pageSize).toBe(12)
   })

   it('should support subscribe, emit state immediately, and unsubscribe', () => {
      const manager = new CoreListManager({ config: { endpoint: 'users' } })
      const listener = jest.fn()

      const unsubscribe = manager.subscribe(listener)
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20 }))

      // Mutate state and emit
      listener.mockClear()
      ;(manager as any).patchState({ page: 3 })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }))

      // Unsubscribe
      unsubscribe()
      listener.mockClear()
      ;(manager as any).patchState({ page: 4 })
      expect(listener).not.toHaveBeenCalled()
   })

   it('should resolve options and run queries via actions.list if specified', async () => {
      const listSpy = jest.fn().mockResolvedValue({ items: [{ uid: 'act-1' }], meta: { count: 1 } })
      const manager = new CoreListManager({
         config: {
            actions: {
               list: listSpy
            }
         }
      })

      await manager.init()
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ offset: 0, batch: 20 }))
      expect((manager as any).state.items).toEqual([{ uid: 'act-1' }])
      expect((manager as any).state.status).toBe('idle')
   })

   it('should resolve options and run queries via fetchFunction if specified', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({ data: [{ uid: 'fn-1' }] })
      const manager = new CoreListManager({
         fetchFunction: fetchSpy,
         endpoint: 'items'
      })

      await manager.init()
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ offset: 0, batch: 20 }))
      expect((manager as any).state.items).toEqual([{ uid: 'fn-1' }])
      expect((manager as any).state.status).toBe('idle')
   })

   it('should fetch relations and replace ID reference with labels during query', async () => {
      const manager = new CoreListManager({
         apiClient: mockApiClient,
         modelSchema: mockSchema
      })

      await manager.init()

      // Relations options should be loaded and pattern applied
      expect(mockApiClient.get).toHaveBeenCalledWith('relatedmodels/values')
      expect((manager as any).state.relationOptions.relationId).toEqual([
         { label: 'Entity One - Selected', value: '1', _search: 'one' },
         { label: 'Entity Two - Selected', value: '2', _search: 'two' }
      ])

      // Relational field replaced in queried items
      expect((manager as any).state.items).toEqual([
         {
            uid: 'r1',
            name: 'Row 1',
            _relationId: '1',
            relationId: 'Entity One - Selected'
         }
      ])
   })

   it('should handle relation fetch failure gracefully', async () => {
      const errorApiClient = {
         get: jest.fn().mockImplementation((url: string) => {
            if (url.endsWith('/values')) {
               return Promise.reject(new Error('Network error'))
            }
            return Promise.resolve({ items: [] })
         })
      }

      const manager = new CoreListManager({
         apiClient: errorApiClient,
         modelSchema: mockSchema
      })

      await manager.init()
      expect((manager as any).state.relationOptions.relationId).toBeUndefined()
      expect((manager as any).state.status).toBe('idle')
   })

   it('should handle list load error and set state to error', async () => {
      const failingApiClient = {
         get: jest.fn().mockRejectedValue(new Error('Query failed'))
      }

      const manager = new CoreListManager({
         apiClient: failingApiClient,
         endpoint: 'test'
      })

      await manager.init()
      expect((manager as any).state.status).toBe('error')
      expect((manager as any).state.error.message).toBe('Query failed')
   })

   it('should fail init and query if no loading adapter is configured', async () => {
      const manager = new CoreListManager({
         endpoint: 'test'
      })

      await manager.init()
      expect((manager as any).state.status).toBe('error')
      expect((manager as any).state.error.message).toContain('No list action, fetchFunction, or apiClient + endpoint')
   })

   it('should trigger queries with updated params via setPage, setPageSize, setSorting, and setFilters', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({ items: [], meta: { count: 0 } })
      const manager = new CoreListManager({
         fetchFunction: fetchSpy,
         endpoint: 'test'
      })

      // setPage
      manager.setPage(3)
      expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 40, batch: 20 }))

      // setPageSize
      manager.setPageSize(50)
      expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0, batch: 50 }))

      // setSorting
      manager.setSorting({ field: 'title', order: 'asc' })
      expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ fsort: 'title', osort: 'asc' }))

      // setFilters
      manager.setFilters({ status: 'active', user: { ref: 'user-1' } })
      expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({
         q: {
            status: 'active',
            user: ['user-1', 'equals', 'ref']
         }
      }))
   })

   it('should handle initialization failure in catch block', async () => {
      const manager = new CoreListManager({ endpoint: 'test' })
      jest.spyOn(manager as any, 'fetchRelations').mockRejectedValue(new Error('Init fail'))

      await manager.init()
      expect((manager as any).state.status).toBe('error')
      expect((manager as any).state.error.message).toBe('Init fail')
   })

   it('should cover all edge cases of configuration and data mapping', async () => {
      // 1. modelSchema without a name, properties fallback, and type fallback in fetchRelations
      const minimalSchema = {
         properties: [
            {
               name: 'refId',
               type: 'CustomType',
               options: {
                  instanceOf: true, // not a string
               }
            },
            {
               name: 'simpleProp', // regular property without instanceOf option to cover non-relational branch
               type: 'StringProperty'
            }
         ]
      }
      const testApiClient = {
         get: jest.fn().mockResolvedValue({
            data: [
               { value: 'v1' } // item has no name, falls back to item.value
            ]
         })
      }
      const manager1 = new CoreListManager({
         apiClient: testApiClient as any,
         modelSchema: minimalSchema as any
      })
      await manager1.init()
      expect(manager1.getConfig().endpoint).toBeUndefined() // minimalSchema has no name, so no endpoint fallback
      expect((manager1 as any).state.relationOptions.refId).toEqual([
         { label: 'v1', value: 'v1', _search: '' }
      ])

      // 1b. modelSchema with no properties list at all to cover default [] branch
      const emptySchema = {
         name: 'EmptyModel'
      }
      const managerEmpty = new CoreListManager({
         apiClient: testApiClient as any,
         modelSchema: emptySchema as any
      })
      await managerEmpty.init()
      expect(managerEmpty.getConfig().endpoint).toBe('emptymodels')

      // 2. pattern replace with undefined key fallback
      const patternSchema = {
         PROPS_DEFINITION: [
            {
               name: 'refId',
               type: 'CustomType',
               options: {
                  instanceOf: 'CustomType',
                  pattern: '${nonexistent} - label'
               }
            }
         ]
      }
      const patternApiClient = {
         get: jest.fn().mockResolvedValue({
            data: [
               { value: 'v1' }
            ]
         })
      }
      const manager2 = new CoreListManager({
         apiClient: patternApiClient as any,
         modelSchema: patternSchema as any
      })
      await manager2.init()
      // should preserve matched placeholder string since it's undefined
      expect((manager2 as any).state.relationOptions.refId[0].label).toContain('${nonexistent}')

      // 3. fetchFunction returning undefined/null or empty object
      const emptyFetch = jest.fn().mockResolvedValue(null)
      const manager3 = new CoreListManager({
         fetchFunction: emptyFetch,
         endpoint: 'test'
      })
      await manager3.init()
      expect((manager3 as any).state.items).toEqual([])

      // 4. query data mapping when mapped relation item isn't found
      const manager4 = new CoreListManager({
         apiClient: mockApiClient,
         modelSchema: mockSchema
      })
      mockApiClient.get.mockImplementation((url: string) => {
         if (url.endsWith('/values')) {
            return Promise.resolve({ data: [] }) // no relations found
         }
         return Promise.resolve({
            items: [{ uid: 'r1', name: 'Row 1', relationId: 'nonexistent-value' }]
         })
      })
      await manager4.init()
      expect((manager4 as any).state.items[0].relationId).toBe('nonexistent-value') // preserved
   })

   it('should cover the fallback to empty array when relationOptions is undefined/missing', async () => {
      const testApiClient = {
         get: jest.fn().mockImplementation((url: string) => {
            if (url.endsWith('/values')) {
               return Promise.reject(new Error('Failed to load relations'))
            }
            return Promise.resolve({
               items: [{ uid: 'r1', name: 'Row 1', relationId: '1' }]
            })
         })
      }

      const manager = new CoreListManager({
         apiClient: testApiClient,
         modelSchema: mockSchema
      })

      await manager.init()
      expect((manager as any).state.relationOptions.relationId).toBeUndefined()
      expect((manager as any).state.items).toEqual([
         { uid: 'r1', name: 'Row 1', relationId: '1' }
      ])
   })
})
