import { CoreFormManager } from './CoreFormManager'

describe('CoreFormManager Headless Form Handler', () => {
   let mockModelSchema: any
   let mockApiClient: any

   beforeEach(() => {
      mockModelSchema = {
         name: 'User',
         properties: [
            { name: 'name', type: 'StringProperty', required: true },
            { name: 'email', type: 'StringProperty', mandatory: true },
            { name: 'role', type: 'ObjectProperty', options: { instanceOf: 'Role' } },
            { name: 'studio', type: 'ObjectProperty', options: { instanceOf: 'Studio', pattern: '${title} (${type})' } }
         ]
      }

      mockApiClient = {
         get: jest.fn(),
         post: jest.fn(),
         patch: jest.fn()
      }
   })

   it('should initialize with default FormState', () => {
      const manager = new CoreFormManager(mockModelSchema, undefined, mockApiClient)
      
      const listener = jest.fn()
      const unsubscribe = manager.subscribe(listener)

      expect(listener).toHaveBeenCalledWith({
         formData: { status: 'created' },
         relationOptions: {},
         status: 'idle',
         error: null,
         validationErrors: {}
      })

      unsubscribe()
   })

   it('should support subscribing and unsubscribing listeners', () => {
      const manager = new CoreFormManager(mockModelSchema, undefined, mockApiClient)
      const listener = jest.fn()

      const unsubscribe = manager.subscribe(listener)
      expect(listener).toHaveBeenCalledTimes(1)

      manager.setProperty('name', 'John')
      expect(listener).toHaveBeenCalledTimes(2)

      unsubscribe()
      manager.setProperty('name', 'Doe')
      expect(listener).toHaveBeenCalledTimes(2) // No more calls after unsubscribe
   })

   it('should update specific property values via setProperty', () => {
      const manager = new CoreFormManager(mockModelSchema, undefined, mockApiClient)
      
      const stateListener = jest.fn()
      manager.subscribe(stateListener)

      manager.setProperty('name', 'Alice')
      expect(stateListener).toHaveBeenLastCalledWith(expect.objectContaining({
         formData: { status: 'created', name: 'Alice' }
      }))
   })

   describe('validate', () => {
      it('should return true if all mandatory/required properties are present', () => {
         const manager = new CoreFormManager(mockModelSchema, undefined, mockApiClient)
         manager.setProperty('name', 'John')
         manager.setProperty('email', 'john@example.com')

         expect(manager.validate()).toBe(true)
         
         const listener = jest.fn()
         manager.subscribe(listener)
         expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
            validationErrors: {}
         }))
      })

      it('should return false and list validation errors if mandatory fields are missing', () => {
         const manager = new CoreFormManager(mockModelSchema, undefined, mockApiClient)
         manager.setProperty('name', '') // empty

         expect(manager.validate()).toBe(false)
         
         const listener = jest.fn()
         manager.subscribe(listener)
         expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
            validationErrors: {
               name: 'name is required',
               email: 'email is required'
            }
         }))
      })
      
      it('should handle schemas with no properties gracefully', () => {
         const emptySchema = { name: 'Empty' }
         const manager = new CoreFormManager(emptySchema, undefined, mockApiClient)
         expect(manager.validate()).toBe(true)
      })
   })

   describe('init', () => {
      it('should fetch existing record data and format relations on success', async () => {
         mockApiClient.get.mockImplementation((url: string) => {
            if (url === 'users/123') {
               return Promise.resolve({ data: { name: 'John Doe', email: 'john@doe.com' } })
            }
            if (url === 'roles/values') {
               return Promise.resolve({ data: [{ name: 'Admin', value: 'admin' }] })
            }
            if (url === 'studios/values') {
               return Promise.resolve({ data: [{ title: 'Main', type: 'hq', value: 'main-studio', _search: 'main hq' }] })
            }
            return Promise.reject(new Error(`Unexpected GET to ${url}`))
         })

         const manager = new CoreFormManager(mockModelSchema, '123', mockApiClient)
         
         const stateListener = jest.fn()
         manager.subscribe(stateListener)

         await manager.init()

         // Verify the API client gets called correctly
         expect(mockApiClient.get).toHaveBeenCalledWith('users/123')
         expect(mockApiClient.get).toHaveBeenCalledWith('roles/values')
         expect(mockApiClient.get).toHaveBeenCalledWith('studios/values')

         // Verify loading state changes
         expect(stateListener).toHaveBeenCalledWith(expect.objectContaining({ status: 'loading' }))
         expect(stateListener).toHaveBeenLastCalledWith(expect.objectContaining({
            status: 'idle',
            formData: { status: 'created', name: 'John Doe', email: 'john@doe.com' },
            relationOptions: {
               role: [{ label: 'Admin', value: 'admin', _search: '' }],
               studio: [{ label: 'Main (hq)', value: 'main-studio', _search: 'main hq' }]
            }
         }))
      })

      it('should skip data fetching when objectId is "new" or undefined, but fetch relations', async () => {
         mockApiClient.get.mockResolvedValue({ data: [] })
         const manager = new CoreFormManager(mockModelSchema, 'new', mockApiClient)
         
         await manager.init()

         expect(mockApiClient.get).not.toHaveBeenCalledWith('users/new')
         expect(mockApiClient.get).toHaveBeenCalledWith('roles/values')
      })

      it('should set status to error if data fetch fails', async () => {
         const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
         mockApiClient.get.mockRejectedValue(new Error('Network failure'))

         const manager = new CoreFormManager(mockModelSchema, '123', mockApiClient)
         await manager.init()

         const listener = jest.fn()
         manager.subscribe(listener)
         expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
            status: 'error',
            error: expect.any(Error)
         }))

         consoleErrorSpy.mockRestore()
      })
      
      it('should handle relation options returning empty/missing data gracefully', async () => {
         const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
         
         mockApiClient.get.mockImplementation((url: string) => {
            if (url === 'users/123') {
               return Promise.resolve({ data: { name: 'John' } })
            }
            if (url === 'roles/values') {
               return Promise.resolve(null) // No data
            }
            if (url === 'studios/values') {
               return Promise.reject(new Error('Relation fetch error'))
            }
            return Promise.reject(new Error(`Unexpected GET to ${url}`))
         })

         const manager = new CoreFormManager(mockModelSchema, '123', mockApiClient)
         await manager.init()

         const listener = jest.fn()
         manager.subscribe(listener)
         expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
            status: 'idle',
            relationOptions: {
               role: undefined,
               studio: undefined
            }
         }))

         consoleErrorSpy.mockRestore()
      })
   })

   describe('save', () => {
      it('should validate form and throw validation error if fields are missing', async () => {
         const manager = new CoreFormManager(mockModelSchema, 'new', mockApiClient)
         manager.setProperty('name', '') // Missing email too

         await expect(manager.save()).rejects.toThrow('Validation failed')
         expect(mockApiClient.post).not.toHaveBeenCalled()
      })

      it('should perform POST request when objectId is "new"', async () => {
         const manager = new CoreFormManager(mockModelSchema, 'new', mockApiClient)
         manager.setProperty('name', 'John')
         manager.setProperty('email', 'john@doe.com')

         mockApiClient.post.mockResolvedValue({ data: { id: '777' } })

         const stateListener = jest.fn()
         manager.subscribe(stateListener)

         await manager.save()

         expect(mockApiClient.post).toHaveBeenCalledWith('users', {
            status: 'created',
            name: 'John',
            email: 'john@doe.com'
         })
         expect(stateListener).toHaveBeenCalledWith(expect.objectContaining({ status: 'saving' }))
         expect(stateListener).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'idle' }))
      })

      it('should perform PATCH request when objectId is an existing ID', async () => {
         const manager = new CoreFormManager(mockModelSchema, '123', mockApiClient)
         manager.setProperty('name', 'John')
         manager.setProperty('email', 'john@doe.com')

         mockApiClient.patch.mockResolvedValue({ data: { success: true } })

         await manager.save()

         expect(mockApiClient.patch).toHaveBeenCalledWith('users/123', {
            status: 'created',
            name: 'John',
            email: 'john@doe.com'
         })
      })

      it('should set status to error and map backend validation errors on API save failure', async () => {
         const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
         
         const manager = new CoreFormManager(mockModelSchema, 'new', mockApiClient)
         manager.setProperty('name', 'John')
         manager.setProperty('email', 'john@doe.com')

         const mockError: any = new Error('Unprocessable Entity')
         mockError.response = {
            data: {
               validationErrors: {
                  email: 'Email address already exists'
               }
            }
         }
         mockApiClient.post.mockRejectedValue(mockError)

         await expect(manager.save()).rejects.toThrow('Unprocessable Entity')

         const listener = jest.fn()
         manager.subscribe(listener)
         expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
            status: 'error',
            error: mockError,
            validationErrors: {
               email: 'Email address already exists'
            }
         }))

         consoleErrorSpy.mockRestore()
      })
   })
})
