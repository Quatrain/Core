import { AstroRbacMiddleware } from './AstroRbacMiddleware'
import { RbacPolicyEngine } from '../engine/RbacPolicyEngine'
import type { RoleDefinition } from '../types'

describe('AstroRbacMiddleware', () => {
  const roles: RoleDefinition[] = [
    {
      id: 'reader',
      name: 'Reader',
      routes: [
        { pattern: '/api/taxonomies', methods: ['GET'], access: 'allow' },
        { pattern: '/docs/**', methods: ['GET'], access: 'allow' }
      ]
    },
    {
      id: 'admin',
      name: 'Admin',
      routes: [{ pattern: '/**', methods: ['*'], access: 'allow' }]
    }
  ]

  let engine: RbacPolicyEngine
  let middleware: AstroRbacMiddleware

  beforeEach(() => {
    engine = new RbacPolicyEngine(roles)
    middleware = new AstroRbacMiddleware(engine, { enableTarpitSleep: false })
  })

  function createMockAstroContext(urlPath: string, method: string = 'GET', user?: any) {
    const context: any = {
      url: new URL(`http://localhost:4321${urlPath}`),
      request: new Request(`http://localhost:4321${urlPath}`, { method }),
      locals: { user },
      redirect: jest.fn((path: string) => {
        return new Response(null, { status: 302, headers: { Location: path } })
      })
    }
    const next = jest.fn(async () => new Response('OK', { status: 200 }))
    return { context, next }
  }

  it('allows access to permitted API endpoint and injects locals.rbac', async () => {
    const { context, next } = createMockAstroContext('/api/taxonomies', 'GET', {
      id: 'u-1',
      roles: ['reader']
    })

    const handler = middleware.handler()
    const res = await handler(context, next)

    expect(res.status).toBe(200)
    expect(next).toHaveBeenCalled()
    expect(context.locals.rbac).toBeDefined()
    expect(context.locals.rbac.canAccessRoute('/api/taxonomies', 'GET')).toBe(true)
  })

  it('returns JSON 401 when unauthenticated on protected API endpoint', async () => {
    const { context, next } = createMockAstroContext('/api/admin/secrets', 'GET', undefined)

    const handler = middleware.handler()
    const res = await handler(context, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('unauthenticated')
  })

  it('returns JSON 403 when authenticated user lacks permissions on API endpoint', async () => {
    const { context, next } = createMockAstroContext('/api/admin/secrets', 'GET', {
      id: 'u-1',
      roles: ['reader']
    })

    const handler = middleware.handler()
    const res = await handler(context, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('forbidden')
  })

  it('redirects to /login when unauthenticated on protected HTML page', async () => {
    const { context, next } = createMockAstroContext('/dashboard', 'GET', undefined)

    const handler = middleware.handler()
    const res = await handler(context, next)

    expect(next).not.toHaveBeenCalled()
    expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining('/login?returnTo='))
    expect(res.status).toBe(302)
  })
})
