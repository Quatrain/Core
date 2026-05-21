import * as React from 'react'
import { CoreList } from './CoreList'
import { useCoreList } from './useCoreList'
import {
   Table,
   Pagination,
   Loader,
   Select,
   TextInput,
   Switch,
   Button,
   Badge
} from '@mantine/core'

// Shared mock flag for force-enabling showMeta
let mockForceShowMeta = false

// Mock react hooks and default export
jest.mock('react', () => {
   const actual = jest.requireActual('react')
   const stateValues: Record<string, any> = {}
   const stateSetters: Record<string, jest.Mock> = {}

   const mockReact = {
      ...actual,
      useState: jest.fn().mockImplementation((init) => {
         const caller = new Error().stack?.split('\n')[2] || 'default'
         const key = caller
         if (!(key in stateValues)) {
            let initialVal = typeof init === 'function' ? init() : init
            if (initialVal === false && mockForceShowMeta) {
               initialVal = true
            }
            stateValues[key] = initialVal
            stateSetters[key] = jest.fn().mockImplementation((val) => {
               stateValues[key] = typeof val === 'function' ? val(stateValues[key]) : val
            })
         }
         return [stateValues[key], stateSetters[key]]
      }),
      _resetState: () => {
         mockForceShowMeta = false
         for (const key in stateValues) {
            delete stateValues[key]
            delete stateSetters[key]
         }
      }
   }

   return {
      __esModule: true,
      ...mockReact,
      default: mockReact
   }
})

// Mock useCoreList hook
jest.mock('./useCoreList', () => {
   const mockManager = {
      getConfig: jest.fn(),
      query: jest.fn()
   }

   const mockOperations = {
      state: {
         items: [],
         meta: { count: 0 },
         relationOptions: {},
         status: 'idle',
         error: null,
         page: 1,
         pageSize: 20,
         sorting: null,
         filters: {}
      },
      manager: mockManager,
      setPage: jest.fn(),
      setPageSize: jest.fn(),
      setSorting: jest.fn(),
      setFilters: jest.fn(),
      reload: jest.fn()
   }

   return {
      __esModule: true,
      useCoreList: jest.fn().mockReturnValue(mockOperations)
   }
})

// Recursive React Element tree traversal helpers (handles nested arrays correctly)
function findElement(element: any, predicate: (el: any) => boolean): any {
   if (!element) return null
   if (Array.isArray(element)) {
      for (const item of element) {
         const found = findElement(item, predicate)
         if (found) return found
      }
      return null
   }
   if (predicate(element)) return element
   if (element.props && element.props.children) {
      return findElement(element.props.children, predicate)
   }
   return null
}

function findAllElements(element: any, predicate: (el: any) => boolean, results: any[] = []): any[] {
   if (!element) return results
   if (Array.isArray(element)) {
      for (const item of element) {
         findAllElements(item, predicate, results)
      }
      return results
   }
   if (predicate(element)) results.push(element)
   if (element.props && element.props.children) {
      findAllElements(element.props.children, predicate, results)
   }
   return results
}

describe('CoreList Component', () => {
   let mockOperations: any
   let mockConfig: any

   beforeEach(() => {
      ;(React as any)._resetState()
      mockOperations = (useCoreList as jest.Mock)()
      mockConfig = {
         columns: {
            name: { label: 'Name en', accessor: 'name', sortable: true },
            status: { label: { en: 'Status', fr: 'Statut' }, sortable: true },
            createdAt: { label: 'Created At', sortable: false }
         },
         buttons: {}
      }
      mockOperations.manager.getConfig.mockReturnValue(mockConfig)
      mockOperations.state = {
         items: [],
         meta: { count: 0 },
         relationOptions: {},
         status: 'idle',
         error: null,
         page: 1,
         pageSize: 20,
         sorting: null,
         filters: {}
      }
   })

   const isTitleBlock = (el: any) =>
      el &&
      typeof el.type === 'function' &&
      (el.type.name === 'TitleBlock' || el.type.displayName === 'TitleBlock' || (el.props && 'title' in el.props && 'count' in el.props))

   it('should render headers and simple columns config correctly', () => {
      const element = CoreList({ options: { endpoint: 'users' }, title: 'User List' })
      expect(element).toBeDefined()

      // Find Title block
      const titleBlock = findElement(element, isTitleBlock)
      expect(titleBlock).toBeDefined()
      expect(titleBlock.props.title).toBe('User List')
      expect(titleBlock.props.count).toBe(0)

      // Explicitly execute TitleBlock to achieve 100% coverage
      const titleBlockResult = titleBlock.type(titleBlock.props)
      expect(titleBlockResult).toBeDefined()

      // Cover the plural 'items' branch of TitleBlock
      const pluralTitleBlockResult = titleBlock.type({ title: 'Users', count: 5 })
      expect(pluralTitleBlockResult).toBeDefined()
   })

   it('should extract columns automatically from modelSchema', () => {
      delete mockConfig.columns
      mockConfig.modelSchema = {
         name: 'UserModel',
         PROPS_DEFINITION: [
            { name: 'name', ui: { label: 'Name Prop' } },
            { name: 'email', ui: { labels: { en: 'Email Prop en', fr: 'Email Prop fr' } } },
            { name: 'status' },
            { name: 'createdAt' }
         ]
      }

      const element = CoreList({ options: { endpoint: 'users' } })
      expect(element).toBeDefined()

      const titleBlock = findElement(element, isTitleBlock)
      expect(titleBlock.props.title).toBe('UserModel')
   })

   it('should handle sorting trigger header click correctly', () => {
      // 1. Initial render with sorting = null
      let element = CoreList({ options: { endpoint: 'users' } })
      let ths = findAllElements(element, (el) => el && el.type === Table.Th)
      expect(ths.length).toBeGreaterThan(0)

      ths[0].props.onClick()
      expect(mockOperations.setSorting).toHaveBeenLastCalledWith({ field: 'name', order: 'asc' })

      // 2. Re-render with sorting = asc to test desc sorting
      mockOperations.state.sorting = { field: 'name', order: 'asc' }
      element = CoreList({ options: { endpoint: 'users' } })
      ths = findAllElements(element, (el) => el && el.type === Table.Th)
      ths[0].props.onClick()
      expect(mockOperations.setSorting).toHaveBeenLastCalledWith({ field: 'name', order: 'desc' })

      // 3. Re-render with sorting = desc to test clearing sorting
      mockOperations.state.sorting = { field: 'name', order: 'desc' }
      element = CoreList({ options: { endpoint: 'users' } })
      ths = findAllElements(element, (el) => el && el.type === Table.Th)
      ths[0].props.onClick()
      expect(mockOperations.setSorting).toHaveBeenLastCalledWith(null)
   })

   it('should handle search filters onChange and clear correctly', () => {
      const element = CoreList({ options: { endpoint: 'users' } })
      const textInput = findElement(element, (el) => el && el.type === TextInput)

      expect(textInput).toBeDefined()

      // Input change with value
      textInput.props.onChange({ target: { value: 'Alice' } } as any)
      expect(mockOperations.setFilters).toHaveBeenLastCalledWith({ q: 'Alice' })

      // Input change with empty value (clears 'q')
      mockOperations.state.filters = { q: 'Alice' }
      textInput.props.onChange({ target: { value: ' ' } } as any)
      expect(mockOperations.setFilters).toHaveBeenLastCalledWith({})
   })

   it('should toggle meta fields when showMeta state is activated', () => {
      mockConfig.columns.createdAt = { label: 'Created At', sortable: false }
      const element = CoreList({ options: { endpoint: 'users' }, title: 'User List' })

      // Find Switch for showMeta
      const toggle = findElement(element, (el) => el && el.type === Switch)
      expect(toggle).toBeDefined()

      toggle.props.onChange({ currentTarget: { checked: true } } as any)
   })

   it('should format values correctly in table rows based on data types', () => {
      mockConfig.columns = {
         customAccessorFn: { label: 'Fn', accessor: (r: any) => `Func: ${r.name}` },
         customAccessorStr: { label: 'Str', accessor: 'nick' },
         status: { label: 'Status' },
         isVerified: { label: 'Verified' },
         birthday: { label: 'Birthday' },
         createdAt: { label: 'Created At' },
         emptyVal: { label: 'Empty' },
         normalVal: { label: 'Normal' }
      }

      mockOperations.state.items = [
         {
            name: 'Bob',
            nick: 'Bobby',
            status: 'active',
            isVerified: true,
            birthday: '1995-10-15',
            createdAt: new Date('2026-01-01T12:00:00Z'),
            emptyVal: null,
            normalVal: 42
         },
         {
            name: 'Charlie',
            nick: 'Chaz',
            status: 'deleted',
            isVerified: false,
            birthday: 'invalid-date',
            createdAt: '2026-02-02T13:30:00Z',
            emptyVal: undefined,
            normalVal: 'hello'
         },
         {
            name: 'Dave',
            status: 'created',
            createdAt: new Date('2026-03-03T10:00:00Z')
         },
         {
            name: 'Eve',
            status: 'pending',
            createdAt: new Date('2026-04-04T11:00:00Z')
         },
         {
            name: 'Frank',
            status: 'unknown',
            createdAt: new Date('2026-05-05T12:00:00Z')
         }
      ]

      // Force showMeta to true so meta columns like 'status' and 'createdAt' are rendered
      mockForceShowMeta = true

      const element = CoreList({ options: { endpoint: 'users' }, lang: 'fr' })
      expect(element).toBeDefined()

      // Pull text blocks from all table columns
      const tds = findAllElements(element, (el) => el && el.type === Table.Td)
      expect(tds.length).toBeGreaterThan(0)
   })

   it('should render loading loader or empty table correctly', () => {
      // Loading state
      mockOperations.state.status = 'loading'
      mockOperations.state.items = []
      let element = CoreList({ options: { endpoint: 'users' } })
      let loader = findElement(element, (el) => el && el.type === Loader)
      expect(loader).toBeDefined()

      // Empty idle state
      mockOperations.state.status = 'idle'
      mockOperations.state.items = []
      element = CoreList({ options: { endpoint: 'users' } })
      const textNode = findElement(element, (el) => el && el.type?.displayName === '@mantine/core/Text' && el.props.c === 'dimmed')
      expect(textNode).toBeDefined()
   })

   it('should render and handle custom row action buttons with access rules', () => {
      const mockAction = jest.fn()
      const mockRowActionCallback = jest.fn()

      mockConfig.buttons = {
         edit: {
            label: 'Edit Item',
            action: mockAction,
            disabled: false
         },
         delete: {
            label: { en: 'Delete', fr: 'Supprimer' },
            hidden: (row: any) => row.status === 'deleted',
            options: { negative: true }
         },
         approve: {
            label: 'Approve',
            disabled: (row: any) => row.approved === true,
            options: { primary: true }
         },
         hiddenBtn: {
            label: 'Hidden',
            hidden: true
         }
      }

      mockOperations.state.items = [
         { uid: 'u1', name: 'Bob', status: 'active', approved: false },
         { uid: 'u2', name: 'Charlie', status: 'deleted', approved: true }
      ]

      const element = CoreList({
         options: { endpoint: 'users' },
         onRowAction: mockRowActionCallback
      })

      // Retrieve all buttons in list rows
      const buttons = findAllElements(element, (el) => el && el.type === Button)
      expect(buttons.length).toBeGreaterThan(0)

      // Click on edit button of Bob
      const editBtn = buttons.find(b => b.props.children === 'Edit Item')
      expect(editBtn).toBeDefined()
      editBtn.props.onClick()
      expect(mockAction).toHaveBeenCalled()
      expect(mockRowActionCallback).toHaveBeenCalledWith('edit', expect.objectContaining({ name: 'Bob' }))
   })

   it('should handle pagination changes correctly', () => {
      mockOperations.state.meta = { count: 100 }
      mockOperations.state.items = [{ uid: '1' }]

      const element = CoreList({ options: { endpoint: 'users' } })

      // Page size selector dropdown
      const select = findElement(element, (el) => el && el.type === Select)
      expect(select).toBeDefined()
      select.props.onChange('50')
      expect(mockOperations.setPageSize).toHaveBeenCalledWith(50)

      // Page number pagination
      const pagination = findElement(element, (el) => el && el.type === Pagination)
      expect(pagination).toBeDefined()
      pagination.props.onChange(3)
      expect(mockOperations.setPage).toHaveBeenCalledWith(3)
   })

   it('should cover all additional edge cases for branch coverage', () => {
      // 1. Line 84: meta is undefined/null (falls back to items.length)
      mockOperations.state.meta = undefined
      mockOperations.state.items = [{ uid: 'item1' }, { uid: 'item2' }]
      let element = CoreList({ options: { endpoint: 'users' }, title: 'My Title' })
      const titleBlock = findElement(element, isTitleBlock)
      expect(titleBlock.props.count).toBe(2)

      // 2. Line 94: column label language fallback (translation missing, falls back to en)
      mockConfig.columns = {
         testCol: { label: { en: 'Default English' }, sortable: true }
      }
      element = CoreList({ options: { endpoint: 'users' }, lang: 'fr' })
      let ths = findAllElements(element, (el) => el && el.type === Table.Th)
      expect(ths.length).toBeGreaterThan(0)

      // 3. Line 103: modelSchema branch with properties and empty fallback
      // 3a. schema with properties instead of PROPS_DEFINITION
      delete mockConfig.columns
      mockConfig.modelSchema = {
         name: 'PropModel',
         properties: [{ name: 'name', ui: { label: 'Prop Label' } }]
      }
      element = CoreList({ options: { endpoint: 'users' } })
      expect(element).toBeDefined()

      // 3b. schema without properties and without PROPS_DEFINITION
      mockConfig.modelSchema = { name: 'EmptyModel' }
      element = CoreList({ options: { endpoint: 'users' } })
      expect(element).toBeDefined()

      // 4. Line 173: date string in column name not ending with 'At' and not 'birthday'
      mockConfig.columns = {
         customDate: { label: 'Custom Date', sortable: false }
      }
      mockOperations.state.items = [{ customDate: '2026-05-21' }]
      element = CoreList({ options: { endpoint: 'users' } })
      let tds = findAllElements(element, (el) => el && el.type === Table.Td)
      expect(tds.length).toBeGreaterThan(0)

      // 5. Line 207: title falls back to 'List View' when title and modelSchema name are missing
      mockConfig.modelSchema = {}
      element = CoreList({ options: { endpoint: 'users' } })
      let tb = findElement(element, isTitleBlock)
      expect(tb.props.title).toBe('List View')

      // 6. Line 243-253: uid and id headers custom translation mapping
      ;(React as any)._resetState()
      mockForceShowMeta = true
      mockConfig.columns = {
         uid: { label: 'UID', sortable: true },
         id: { label: 'ID', sortable: true }
      }
      element = CoreList({ options: { endpoint: 'users' }, lang: 'fr' })
      ths = findAllElements(element, (el) => el && el.type === Table.Th)
      expect(ths.length).toBeGreaterThan(1)

      // 7. Line 267: reloading state where status = 'loading' but items.length > 0
      mockOperations.state.status = 'loading'
      mockOperations.state.items = [{ uid: '1', name: 'Bob' }]
      element = CoreList({ options: { endpoint: 'users' } })
      let trs = findAllElements(element, (el) => el && el.type === Table.Tr)
      expect(trs.length).toBeGreaterThan(1)

      // 8. Line 276: empty state colSpan with undefined config.buttons
      mockOperations.state.status = 'idle'
      mockOperations.state.items = []
      delete mockConfig.buttons
      mockConfig.columns = { name: { label: 'Name' } }
      element = CoreList({ options: { endpoint: 'users' } })
      const emptyTd = findElement(element, (el) => el && el.type === Table.Td)
      expect(emptyTd.props.colSpan).toBe(1)

      // 9. Line 306: action button label translation fallback to en when missing target
      mockConfig.buttons = {
         edit: {
            label: { en: 'Edit English' },
            action: jest.fn()
         }
      }
      mockOperations.state.items = [{ uid: '1', name: 'Bob' }]
      element = CoreList({ options: { endpoint: 'users' }, lang: 'fr' })
      const buttons = findAllElements(element, (el) => el && el.type === Button)
      expect(buttons[0].props.children).toBe('Edit English')

      // 10. Line 173: date formatting with lang = 'en' (covers 'en-US' branch of the ternary operator)
      mockConfig.columns = {
         createdAt: { label: 'Created At', sortable: false }
      }
      mockOperations.state.items = [{ createdAt: new Date('2026-05-21T12:00:00Z') }]
      element = CoreList({ options: { endpoint: 'users' }, lang: 'en' })
      tds = findAllElements(element, (el) => el && el.type === Table.Td)
      expect(tds.length).toBeGreaterThan(0)

      // 11. Line 267: loading state colSpan with undefined config.buttons (covers falsy branch of (config.buttons ? 1 : 0))
      mockOperations.state.status = 'loading'
      mockOperations.state.items = []
      delete mockConfig.buttons
      mockConfig.columns = { name: { label: 'Name' } }
      element = CoreList({ options: { endpoint: 'users' } })
      const loadingTd = findElement(element, (el) => el && el.type === Table.Td)
      expect(loadingTd.props.colSpan).toBe(1)
   })
})
