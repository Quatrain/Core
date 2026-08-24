import { ExpressRbacMiddleware } from './ExpressRbacMiddleware'
import { RbacPolicyEngine } from '../engine/RbacPolicyEngine'
import type { RoleDefinition } from '../types'

describe('ExpressRbacMiddleware', () => {
  const roles: RoleDefinition[] = [
    {
      id: 'reader',
      name: 'Reader',
      routes: [
        { pattern: '/api/curate', methods: ['GET'], access: 'allow' },
        { pattern: '/public/**', methods: ['*'], access: 'allow' }
      ]
    },
    {
      id: 'curator',
      name: 'Curator',
      inherits: ['reader'],
      routes: [{ pattern: '/api/curate', methods: ['POST'], access: 'allow' }]
    }
  ]

  let engine: RbacPolicyEngine
  let middleware: ExpressRbacMiddleware

  beforeEach(() => {
    engine = new RbacPolicyEngine(roles)
    middleware = new ExpressRbacMiddleware(engine, { enableTarpitSleep: false })
  })

  function createMockContext(path: string, method: string, user?: any) {
    const req: any = {
      path,
      method,
      user
    }
    const res: any = {
      statusCode: 200,
      status: jest.fn(function (code) {
        this.statusCode = code
        return this
      }),
      json: jest.fn(function (data) {
        this.body = data
        return this
      }),
      setHeader: jest.fn()
    }
    const next = jest.fn()
    return { req, res, next }
  }

  it('allows authorized requests and injects req.rbac helpers', async () => {
    const { req, res, next } = createMockContext('/api/curate', 'GET', {
      id: 'user-1',
      roles: ['reader']
    })

    const handler = middleware.handler()
    await handler(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.rbac).toBeDefined()
    expect(req.rbac.user.id).toBe('user-1')
    expect(typeof req.rbac.sanitizeWrite).toBe('function')
  })

  it('rejects unauthenticated requests with 401 on protected routes', async () => {
    const { req, res, next } = createMockContext('/api/curate', 'POST', undefined)

    const handler = middleware.handler()
    await handler(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unauthorized' })
    )
  })

  it('rejects authenticated requests with 403 when role is insufficient', async () => {
    const { req, res, next } = createMockContext('/api/curate', 'POST', {
      id: 'user-1',
      roles: ['reader']
    })

    const handler = middleware.handler()
    await handler(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' })
    )
  })
})
