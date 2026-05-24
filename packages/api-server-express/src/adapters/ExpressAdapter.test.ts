import express from 'express'
import { ExpressAdapter } from './ExpressAdapter'
import { ApiRequest, ApiResponse } from '@quatrain/api'

describe('ExpressAdapter', () => {
   let app: express.Application
   let adapter: ExpressAdapter

   beforeEach(() => {
      app = express()
      adapter = new ExpressAdapter(app)
   })

   describe('Constructor and Default Middlewares', () => {
      it('should instantiate and configure default settings', () => {
         const mockApp = {
            disable: jest.fn(),
            use: jest.fn(),
            listen: jest.fn()
         }
         const ad = new ExpressAdapter(mockApp as any)
         expect(mockApp.disable).toHaveBeenCalledWith('x-powered-by')
         expect(mockApp.use).toHaveBeenCalled()
         expect(ad.getNativeInstance()).toBe(mockApp)
      })

      it('should correctly configure default CORS headers and handle OPTIONS request', async () => {
         let corsHandler: express.RequestHandler | null = null
         const mockApp = {
            disable: jest.fn(),
            use: jest.fn((middleware) => {
               if (typeof middleware === 'function' && middleware.length === 3) {
                  corsHandler = middleware
               }
            }),
            listen: jest.fn()
         }
         new ExpressAdapter(mockApp as any)

         expect(corsHandler).not.toBeNull()

         const mockReq = { method: 'OPTIONS' } as express.Request
         const headersSent: Record<string, string> = {}
         let statusSent: number | null = null

         const mockRes = {
            header: (name: string, value: string) => {
               headersSent[name] = value
            },
            sendStatus: (code: number) => {
               statusSent = code
            }
         } as any

         const mockNext = jest.fn()

         if (corsHandler) {
            (corsHandler as express.RequestHandler)(mockReq, mockRes, mockNext)
         }

         expect(headersSent['Access-Control-Allow-Origin']).toBe('*')
         expect(headersSent['Access-Control-Allow-Methods']).toBe('GET, PUT, POST, DELETE, OPTIONS')
         expect(headersSent['Access-Control-Allow-Headers']).toBe('*')
         expect(statusSent).toBe(200)
         expect(mockNext).not.toHaveBeenCalled()
      })

      it('should let non-OPTIONS requests pass through default CORS middleware', () => {
         let corsHandler: express.RequestHandler | null = null
         const mockApp = {
            disable: jest.fn(),
            use: jest.fn((middleware) => {
               if (typeof middleware === 'function' && middleware.length === 3) {
                  corsHandler = middleware
               }
            }),
            listen: jest.fn()
         }
         new ExpressAdapter(mockApp as any)

         const mockReq = { method: 'GET' } as express.Request
         const mockRes = { header: jest.fn(), sendStatus: jest.fn() } as any
         const mockNext = jest.fn()

         if (corsHandler) {
            (corsHandler as express.RequestHandler)(mockReq, mockRes, mockNext)
         }

         expect(mockNext).toHaveBeenCalled()
      })
   })

   describe('HTTP Verbs Registration', () => {
      it('should register routes with express routes mapping', () => {
         const mockRouter = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn()
         }
         const ad = new ExpressAdapter(mockRouter as any)

         const handler = async (req: ApiRequest, res: ApiResponse) => {}

         ad.get('/test', handler)
         ad.post('/test', handler)
         ad.put('/test', handler)
         ad.delete('/test', handler)

         expect(mockRouter.get).toHaveBeenCalledWith('/test', expect.any(Function))
         expect(mockRouter.post).toHaveBeenCalledWith('/test', expect.any(Function))
         expect(mockRouter.put).toHaveBeenCalledWith('/test', expect.any(Function))
         expect(mockRouter.delete).toHaveBeenCalledWith('/test', expect.any(Function))
      })

      it('should map Request and Response objects correctly', async () => {
         const mockRouter = {
            get: jest.fn((path, wrapped) => {
               const req = {
                  body: { key: 'value' },
                  params: { id: '123' },
                  query: { search: 'text' },
                  headers: { authorization: 'Bearer token' }
               }
               const res = {
                  status: jest.fn().mockReturnThis(),
                  json: jest.fn(),
                  send: jest.fn(),
                  setHeader: jest.fn(),
                  write: jest.fn(),
                  end: jest.fn()
               }
               const next = jest.fn()
               wrapped(req, res, next)
            })
         }

         const ad = new ExpressAdapter(mockRouter as any)
         let capturedReq: ApiRequest | null = null
         let capturedRes: ApiResponse | null = null

         ad.get('/test', async (req, res) => {
            capturedReq = req
            capturedRes = res
            res.status(201).json({ success: true })
            res.send('Done')
            res.setHeader('X-Custom', 'Value')
            res.write('Chunk')
            res.end()
         })

         // Force async block inside ExpressAdapter wrapped callback to run
         await new Promise((resolve) => setTimeout(resolve, 10))

         expect(capturedReq).not.toBeNull()
         expect(capturedReq?.body).toEqual({ key: 'value' })
         expect(capturedReq?.params).toEqual({ id: '123' })
         expect(capturedReq?.query).toEqual({ search: 'text' })
         expect(capturedReq?.headers?.authorization).toBe('Bearer token')

         expect(capturedRes).not.toBeNull()
      })
   })

   describe('Middleware Routing and Mounting', () => {
      it('should support native Express middleware attach via use', () => {
         const mockRouter = { use: jest.fn() }
         const ad = new ExpressAdapter(mockRouter as any)
         const dummyMiddleware = () => {}

         ad.use(dummyMiddleware)
         expect(mockRouter.use).toHaveBeenCalledWith(dummyMiddleware)
      })

      it('should add Quatrain-compatible API middleware', async () => {
         let middlewareHandler: express.RequestHandler | null = null
         const mockRouter = {
            use: jest.fn((mw) => {
               middlewareHandler = mw
            })
         }
         const ad = new ExpressAdapter(mockRouter as any)

         const apiMiddleware = jest.fn().mockResolvedValue(true)
         ad.addMiddleware(apiMiddleware)

         expect(middlewareHandler).not.toBeNull()

         const mockReq = { headers: {} } as express.Request
         const mockRes = {} as express.Response
         const mockNext = jest.fn()

         if (middlewareHandler) {
            (middlewareHandler as express.RequestHandler)(mockReq, mockRes, mockNext)
         }

         await new Promise((resolve) => setTimeout(resolve, 10))

         expect(apiMiddleware).toHaveBeenCalled()
         expect(mockNext).toHaveBeenCalled()
      })

      it('should stop propagation if API middleware returns false', async () => {
         let middlewareHandler: express.RequestHandler | null = null
         const mockRouter = {
            use: jest.fn((mw) => {
               middlewareHandler = mw
            })
         }
         const ad = new ExpressAdapter(mockRouter as any)

         const apiMiddleware = jest.fn().mockResolvedValue(false)
         ad.addMiddleware(apiMiddleware)

         const mockReq = { headers: {} } as express.Request
         const mockRes = {} as express.Response
         const mockNext = jest.fn()

         if (middlewareHandler) {
            (middlewareHandler as express.RequestHandler)(mockReq, mockRes, mockNext)
         }

         await new Promise((resolve) => setTimeout(resolve, 10))

         expect(apiMiddleware).toHaveBeenCalled()
         expect(mockNext).not.toHaveBeenCalled()
      })
   })

   describe('Subrouters and Endpoints block', () => {
      it('should spawn subrouters correctly', () => {
         const mockRouter = { use: jest.fn() }
         const ad = new ExpressAdapter(mockRouter as any)

         const sub = ad.createRouter('/sub')
         expect(sub).toBeInstanceOf(ExpressAdapter)
         expect(mockRouter.use).toHaveBeenCalledWith('/sub', expect.any(Function))
      })

      it('should mount composite endpoints using options and prefix', () => {
         const mockRouter = { use: jest.fn() }
         const ad = new ExpressAdapter(mockRouter as any, { apiPrefix: '/v1' })

         const endpointHandler = jest.fn()
         const mockMiddleware = () => {}

         ad.addEndpoint(endpointHandler, '/items', {
            middlewares: [mockMiddleware]
         })

         expect(mockRouter.use).toHaveBeenCalledWith('/v1/items', expect.any(Function))
         expect(endpointHandler).toHaveBeenCalled()
      })
   })

   describe('SPA Static Files and start mechanisms', () => {
      it('should setup static assets and wildcard redirects for SPA paths', () => {
         const mockRouter = {
            use: jest.fn(),
            get: jest.fn()
         }
         const ad = new ExpressAdapter(mockRouter as any)

         ad.serveStatic('/dist', '/api')

         expect(mockRouter.use).toHaveBeenCalled()
         expect(mockRouter.get).toHaveBeenCalledWith('*', expect.any(Function))
      })

      it('should pass API request calls through sendFile redirects', () => {
         let fallbackHandler: express.RequestHandler | null = null
         const mockRouter = {
            use: jest.fn(),
            get: jest.fn((path, handler) => {
               if (path === '*') fallbackHandler = handler
            })
         }
         const ad = new ExpressAdapter(mockRouter as any)
         ad.serveStatic('/dist', '/api')

         expect(fallbackHandler).not.toBeNull()

         const mockReq = { path: '/api/v1/items' } as express.Request
         const mockRes = {} as express.Response
         const mockNext = jest.fn()

         if (fallbackHandler) {
            (fallbackHandler as express.RequestHandler)(mockReq, mockRes, mockNext)
         }

         expect(mockNext).toHaveBeenCalled()
      })

      it('should boot and start standard web networks', () => {
         const mockApp = {
            disable: jest.fn(),
            use: jest.fn(),
            listen: jest.fn()
         }
         const ad = new ExpressAdapter(mockApp as any)
         ad.start(4001)

         expect(mockApp.listen).toHaveBeenCalledWith(4001, undefined)
      })

      it('should fail starting routing nodes directly', () => {
         const router = express.Router()
         const ad = new ExpressAdapter(router)
         expect(() => ad.start(4001)).toThrow("Cannot start a server on a Router instance.")
      })
   })
})
