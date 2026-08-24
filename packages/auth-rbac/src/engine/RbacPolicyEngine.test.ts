import { RbacPolicyEngine } from './RbacPolicyEngine'
import type { RoleDefinition, RbacUserContext } from '../types'

describe('RbacPolicyEngine', () => {
  const roles: RoleDefinition[] = [
    {
      id: 'reader',
      name: 'Reader',
      routes: [
        { pattern: '/api/curate', methods: ['GET'], access: 'allow' },
        { pattern: '/api/taxonomies', methods: ['GET'], access: 'allow' },
        { pattern: '/public/**', methods: ['*'], access: 'allow' },
        { pattern: '/**', methods: ['*'], access: 'deny' }
      ],
      entities: {
        'okf-document': {
          defaultMode: 'readonly',
          fields: {
            internalReviewerNotes: 'hidden',
            telemetryWeights: 'hidden',
            title: 'readonly',
            soa: 'readonly'
          }
        }
      }
    },
    {
      id: 'curator',
      name: 'Curator',
      inherits: ['reader'],
      routes: [
        { pattern: '/api/curate', methods: ['POST', 'PUT'], access: 'allow' },
        { pattern: '/api/upload', methods: ['POST'], access: 'allow' }
      ],
      entities: {
        'okf-document': {
          defaultMode: 'readwrite',
          fields: {
            soa: 'readonly',
            revision: 'readonly',
            internalReviewerNotes: 'hidden'
          }
        }
      }
    },
    {
      id: 'admin',
      name: 'Administrator',
      inherits: ['curator'],
      routes: [{ pattern: '/**', methods: ['*'], access: 'allow' }],
      entities: {
        'okf-document': {
          defaultMode: 'readwrite',
          fields: {
            soa: 'readwrite',
            revision: 'readwrite',
            internalReviewerNotes: 'readwrite'
          }
        }
      }
    },
    {
      id: 'ai-agent',
      name: 'AI Agent Bot',
      subjectTypes: ['agent'],
      routes: [{ pattern: '/api/agent/**', methods: ['POST'], access: 'allow' }],
      tarpit: {
        enabled: true,
        burst: 2,
        maxRequestsPerMinute: 5,
        delayMs: 100
      }
    }
  ]

  let engine: RbacPolicyEngine

  beforeEach(() => {
    engine = new RbacPolicyEngine(roles)
  })

  describe('Route Access Control', () => {
    const readerUser: RbacUserContext = { id: 'u1', roles: ['reader'], subjectType: 'human' }
    const curatorUser: RbacUserContext = { id: 'u2', roles: ['curator'], subjectType: 'human' }
    const adminUser: RbacUserContext = { id: 'u3', roles: ['admin'], subjectType: 'human' }

    it('allows reader to GET /api/curate but denies POST /api/curate', () => {
      expect(engine.canAccessRoute(readerUser, '/api/curate', 'GET')).toBe(true)
      expect(engine.canAccessRoute(readerUser, '/api/curate', 'POST')).toBe(false)
    })

    it('allows curator to GET and POST /api/curate via inherited permissions', () => {
      expect(engine.canAccessRoute(curatorUser, '/api/curate', 'GET')).toBe(true)
      expect(engine.canAccessRoute(curatorUser, '/api/curate', 'POST')).toBe(true)
      expect(engine.canAccessRoute(curatorUser, '/api/upload', 'POST')).toBe(true)
      expect(engine.canAccessRoute(curatorUser, '/admin/settings', 'GET')).toBe(false)
    })

    it('allows admin full access to any route and method', () => {
      expect(engine.canAccessRoute(adminUser, '/admin/settings', 'GET')).toBe(true)
      expect(engine.canAccessRoute(adminUser, '/api/documents/123', 'DELETE')).toBe(true)
    })

    it('applies default deny for unmapped routes or missing roles', () => {
      const anon: RbacUserContext = { id: 'anon', roles: [] }
      expect(engine.canAccessRoute(anon, '/api/curate', 'GET')).toBe(false)
    })
  })

  describe('Field-Level Security (FLS) Calculation', () => {
    const readerUser: RbacUserContext = { id: 'u1', roles: ['reader'] }
    const curatorUser: RbacUserContext = { id: 'u2', roles: ['curator'] }
    const adminUser: RbacUserContext = { id: 'u3', roles: ['admin'] }

    it('resolves field modes accurately per role level', () => {
      // Reader
      expect(engine.getFieldAccess(readerUser, 'okf-document', 'internalReviewerNotes')).toBe('hidden')
      expect(engine.getFieldAccess(readerUser, 'okf-document', 'title')).toBe('readonly')
      expect(engine.getFieldAccess(readerUser, 'okf-document', 'soa')).toBe('readonly')

      // Curator (inherits reader, overrides default to readwrite, but keeps soa readonly and notes hidden)
      expect(engine.getFieldAccess(curatorUser, 'okf-document', 'title')).toBe('readwrite')
      expect(engine.getFieldAccess(curatorUser, 'okf-document', 'soa')).toBe('readonly')
      expect(engine.getFieldAccess(curatorUser, 'okf-document', 'internalReviewerNotes')).toBe('hidden')

      // Admin (full readwrite on all fields)
      expect(engine.getFieldAccess(adminUser, 'okf-document', 'internalReviewerNotes')).toBe('readwrite')
      expect(engine.getFieldAccess(adminUser, 'okf-document', 'soa')).toBe('readwrite')
    })
  })

  describe('Payload Sanitization (sanitizeRead & sanitizeWrite)', () => {
    const rawDocument = {
      title: 'Diagnostic des Sols',
      soa: 'bradtech/world-agronomy',
      revision: 'rev-1.0.0',
      description: 'Analyse terrain',
      internalReviewerNotes: 'Confidential peer review remarks',
      telemetryWeights: { score: 98 }
    }

    it('strips hidden fields on sanitizeRead for readers', () => {
      const readerUser: RbacUserContext = { id: 'u1', roles: ['reader'] }
      const readResult = engine.sanitizeRead(readerUser, 'okf-document', rawDocument)

      expect(readResult.title).toBe('Diagnostic des Sols')
      expect(readResult.soa).toBe('bradtech/world-agronomy')
      expect((readResult as any).internalReviewerNotes).toBeUndefined()
      expect((readResult as any).telemetryWeights).toBeUndefined()
    })

    it('filters out readonly and hidden fields on sanitizeWrite for curators', () => {
      const curatorUser: RbacUserContext = { id: 'u2', roles: ['curator'] }
      const inputUpdate = {
        title: 'Updated Title',
        description: 'New Description',
        soa: 'hacked/malicious-soa', // Readonly -> MUST be stripped
        revision: 'rev-999.0.0', // Readonly -> MUST be stripped
        internalReviewerNotes: 'Injected notes' // Hidden -> MUST be stripped
      }

      const writeResult = engine.sanitizeWrite(curatorUser, 'okf-document', inputUpdate)

      expect(writeResult.title).toBe('Updated Title')
      expect(writeResult.description).toBe('New Description')
      expect((writeResult as any).soa).toBeUndefined()
      expect((writeResult as any).revision).toBeUndefined()
      expect((writeResult as any).internalReviewerNotes).toBeUndefined()
    })

    it('preserves all writable fields on sanitizeWrite for admins', () => {
      const adminUser: RbacUserContext = { id: 'u3', roles: ['admin'] }
      const adminInput = {
        title: 'Admin Override Title',
        soa: 'bradtech/official-authority',
        revision: 'rev-2.0.0',
        internalReviewerNotes: 'Approved by Dr. Dupont'
      }

      const writeResult = engine.sanitizeWrite(adminUser, 'okf-document', adminInput)
      expect(writeResult.title).toBe('Admin Override Title')
      expect(writeResult.soa).toBe('bradtech/official-authority')
      expect(writeResult.revision).toBe('rev-2.0.0')
      expect((writeResult as any).internalReviewerNotes).toBe('Approved by Dr. Dupont')
    })
  })

  describe('Subject Type & Tarpitting for AI Agents', () => {
    it('enforces subjectType matching so human cannot assume agent-only role', () => {
      const humanUser: RbacUserContext = { id: 'h1', roles: ['ai-agent'], subjectType: 'human' }
      expect(engine.canAccessRoute(humanUser, '/api/agent/task', 'POST')).toBe(false)

      const agentUser: RbacUserContext = { id: 'bot-1', roles: ['ai-agent'], subjectType: 'agent' }
      expect(engine.canAccessRoute(agentUser, '/api/agent/task', 'POST')).toBe(true)
    })

    it('injects tarpit delay when an agent exceeds burst limit', () => {
      const agentUser: RbacUserContext = { id: 'bot-fast', roles: ['ai-agent'], subjectType: 'agent' }

      // 1st & 2nd request (burst = 2)
      const res1 = engine.evaluateRoute(agentUser, '/api/agent/task', 'POST')
      expect(res1.allowed).toBe(true)
      expect(res1.tarpitDelayMs).toBe(0)

      const res2 = engine.evaluateRoute(agentUser, '/api/agent/task', 'POST')
      expect(res2.allowed).toBe(true)
      expect(res2.tarpitDelayMs).toBe(0)

      // 3rd request -> burst exceeded -> Tarpit latency injected!
      const res3 = engine.evaluateRoute(agentUser, '/api/agent/task', 'POST')
      expect(res3.allowed).toBe(true)
      expect(res3.tarpitDelayMs).toBeGreaterThan(0)
      expect(res3.isThrottled).toBe(true)
    })
  })
})
