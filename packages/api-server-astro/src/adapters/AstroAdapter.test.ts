import { AstroAdapter } from './AstroAdapter'
import { ApiRequest, ApiResponse } from '@quatrain/api'

let warnSpy: any

// Mock the global warning log to avoid polluting the test outputs
beforeAll(() => {
   warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterAll(() => {
   if (warnSpy) {
      warnSpy.mockRestore()
   }
})

describe('AstroAdapter', () => {
   let adapter: AstroAdapter

   beforeEach(() => {
      adapter = new AstroAdapter()
   })

   describe('Route Registration & Path Matching', () => {
      it('should register GET, POST, PUT, DELETE routes', async () => {
         const getHandler = jest.fn()
         const postHandler = jest.fn()
         const putHandler = jest.fn()
         const deleteHandler = jest.fn()

         adapter.get('/probes', getHandler)
         adapter.post('/probes', postHandler)
         adapter.put('/probes/:id', putHandler)
         adapter.delete('/probes/:id', deleteHandler)

         const handleFn = adapter.handle()

         // Simulate a GET request to /probes
         const mockGetContext = {
            request: new Request('http://localhost/probes', { method: 'GET' }),
            params: {},
            url: new URL('http://localhost/probes')
         }
         const getRes = await handleFn(mockGetContext)
         expect(getRes.status).toBe(200)
         expect(getHandler).toHaveBeenCalled()

         // Simulate a PUT request to /probes/123
         const mockPutContext = {
            request: new Request('http://localhost/probes/123', {
               method: 'PUT',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ name: 'New Name' })
            }),
            params: {},
            url: new URL('http://localhost/probes/123')
         }
         
         const putRes = await handleFn(mockPutContext)
         expect(putRes.status).toBe(200)
         expect(putHandler).toHaveBeenCalledWith(
            expect.objectContaining({
               params: expect.objectContaining({ id: '123' }),
               body: expect.objectContaining({ name: 'New Name' })
            }),
            expect.any(Object)
         )
      })

      it('should return 404 for unmatched routes', async () => {
         adapter.get('/probes', () => {})
         const handleFn = adapter.handle()

         const mockContext = {
            request: new Request('http://localhost/gateways', { method: 'GET' }),
            params: {},
            url: new URL('http://localhost/gateways')
         }

         const res = await handleFn(mockContext)
         expect(res.status).toBe(404)
         const json = await res.json()
         expect(json.error).toContain('Route not found')
      })
   })

   describe('Middleware Integration', () => {
      it('should run registered middlewares before the handler', async () => {
         const middleware = jest.fn().mockResolvedValue(true)
         const handler = jest.fn().mockImplementation((req, res) => {
            res.json({ ok: true })
         })

         adapter.use(middleware)
         adapter.get('/test-mw', handler)

         const handleFn = adapter.handle()
         const context = {
            request: new Request('http://localhost/test-mw', { method: 'GET' }),
            params: {},
            url: new URL('http://localhost/test-mw')
         }

         const res = await handleFn(context)
         expect(res.status).toBe(200)
         expect(middleware).toHaveBeenCalled()
         expect(handler).toHaveBeenCalled()
      })

      it('should stop propagation if middleware returns false', async () => {
         const middleware = jest.fn().mockResolvedValue(false)
         const handler = jest.fn()

         adapter.use(middleware)
         adapter.get('/test-mw-stop', handler)

         const handleFn = adapter.handle()
         const context = {
            request: new Request('http://localhost/test-mw-stop', { method: 'GET' }),
            params: {},
            url: new URL('http://localhost/test-mw-stop')
         }

         const res = await handleFn(context)
         expect(res.status).toBe(200) // Default status if not modified but ended
         expect(middleware).toHaveBeenCalled()
         expect(handler).not.toHaveBeenCalled()
      })
   })

   describe('Subrouters & Nesting', () => {
      it('should support dynamic subrouter registration', async () => {
         const subRouter = adapter.createRouter('/api/v1')
         const handler = jest.fn().mockImplementation((req, res) => {
            res.json({ nested: true })
         })

         subRouter.get('/plots', handler)

         const handleFn = adapter.handle()
         const context = {
            request: new Request('http://localhost/api/v1/plots', { method: 'GET' }),
            params: {},
            url: new URL('http://localhost/api/v1/plots')
         }

         const res = await handleFn(context)
         expect(res.status).toBe(200)
         expect(handler).toHaveBeenCalled()
      })
   })

   describe('Static wrap() helper', () => {
      it('should wrap a single handler into an APIRoute function', async () => {
         const handler = jest.fn().mockImplementation((req, res) => {
            res.status(202).json({ wrapped: true })
         })

         const apiRoute = AstroAdapter.wrap(handler)

         const context = {
            request: new Request('http://localhost/random-path', { method: 'POST' }),
            params: { customId: 'foo' },
            url: new URL('http://localhost/random-path?q=search')
         }

         const res = await apiRoute(context)
         expect(res.status).toBe(202)
         
         const data = await res.json()
         expect(data).toEqual({ wrapped: true })
         expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
               params: expect.objectContaining({ customId: 'foo' }),
               query: expect.objectContaining({ q: 'search' })
            }),
            expect.any(Object)
         )
      })
   })

   describe('Native / serverless compatibility stubs', () => {
      it('should run callback inside start() without failure', () => {
         const callback = jest.fn()
         adapter.start(8080, callback)
         expect(callback).toHaveBeenCalled()
      })

      it('should return itself on getNativeInstance()', () => {
         expect(adapter.getNativeInstance()).toBe(adapter)
      })
   })
})
