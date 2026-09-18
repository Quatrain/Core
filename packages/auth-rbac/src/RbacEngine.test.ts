import { RbacEngine, StandardRole, matchPattern } from './RbacEngine'
import { resolveHttpToSemanticAction, sanitizeResourcePath } from './HttpResolver'
import { AuthorizationError, RbacSubject } from '@quatrain/types'

describe('RbacEngine & Pattern Matching', () => {
   describe('matchPattern', () => {
      it('matches wildcards correctly', () => {
         expect(matchPattern('*', 'anything')).toBe(true)
         expect(matchPattern('medias/*', 'medias/123')).toBe(true)
         expect(matchPattern('medias/*', 'medias/123/variants')).toBe(true)
         expect(matchPattern('medias/*', 'jobs/123')).toBe(false)
      })

      it('matches parameter segments :param', () => {
         expect(matchPattern('companies/:cid/users', 'companies/abc/users')).toBe(true)
         expect(matchPattern('companies/:cid/users', 'companies/abc/jobs')).toBe(false)
      })
   })

   describe('HttpResolver', () => {
      it('resolves standard methods to semantic actions', () => {
         expect(resolveHttpToSemanticAction('GET', '/api/medias')).toBe('read')
         expect(resolveHttpToSemanticAction('POST', '/api/medias')).toBe('create')
         expect(resolveHttpToSemanticAction('POST', '/oauth/token')).toBe('execute')
         expect(resolveHttpToSemanticAction('POST', '/companies/123/rotate-secret')).toBe('execute')
         expect(resolveHttpToSemanticAction('PUT', '/api/medias/1')).toBe('update')
         expect(resolveHttpToSemanticAction('PATCH', '/api/medias/1')).toBe('update')
         expect(resolveHttpToSemanticAction('DELETE', '/api/medias/1')).toBe('delete')
      })

      it('sanitizes resource paths', () => {
         expect(sanitizeResourcePath('/api/medias/123?sort=desc')).toBe('medias/123')
         expect(sanitizeResourcePath('medias/123')).toBe('medias/123')
      })
   })

   describe('Role Evaluation & Root Bypass', () => {
      const rbac = new RbacEngine()

      it('allows root to perform any action on any resource', async () => {
         const rootSubject: RbacSubject = { uid: 'u1', role: StandardRole.ROOT }
         const allowed = await rbac.can(rootSubject, 'delete', 'system/dangerous')
         expect(allowed).toBe(true)
      })

      it('restricts visitor to read on public resources', async () => {
         const visitorSubject: RbacSubject = { uid: 'u2', role: StandardRole.VISITOR }
         expect(await rbac.can(visitorSubject, 'read', 'public/announcements')).toBe(true)
         expect(await rbac.can(visitorSubject, 'create', 'public/announcements')).toBe(false)
         expect(await rbac.can(visitorSubject, 'read', 'private/secrets')).toBe(false)
      })

      it('assert throws AuthorizationError on denial', async () => {
         const visitorSubject: RbacSubject = { uid: 'u2', role: StandardRole.VISITOR }
         await expect(
            rbac.assert(visitorSubject, 'delete', 'public/announcements')
         ).rejects.toThrow(AuthorizationError)
      })
   })

   describe('Admin Role & Direct Token Scopes', () => {
      const rbac = new RbacEngine()

      // Register standard admin role
      rbac.registerRole({
         name: StandardRole.ADMIN,
         inherits: [StandardRole.VISITOR],
         rules: [
            {
               action: ['create', 'read', 'update', 'delete', 'execute'],
               resource: 'companies/:companyId/*',
            },
         ],
      })

      it('allows admin on company resources and inherits visitor', async () => {
         const adminSubject: RbacSubject = {
            uid: 'u3',
            role: StandardRole.ADMIN,
            company: 'companies/comp-1',
         }

         expect(await rbac.can(adminSubject, 'create', 'companies/comp-1/users')).toBe(true)
         expect(await rbac.can(adminSubject, 'read', 'public/announcements')).toBe(true)
      })

      it('evaluates direct scopes for M2M tokens', async () => {
         const m2mTokenSubject: RbacSubject = {
            uid: 'app-token-1',
            role: 'm2m-app',
            scopes: ['read:medias/*', 'execute:oauth/token', 'create:jobs'],
         }

         expect(await rbac.can(m2mTokenSubject, 'read', 'medias/image.jpg')).toBe(true)
         expect(await rbac.can(m2mTokenSubject, 'execute', 'oauth/token')).toBe(true)
         expect(await rbac.can(m2mTokenSubject, 'create', 'jobs')).toBe(true)
         expect(await rbac.can(m2mTokenSubject, 'delete', 'medias/image.jpg')).toBe(false)
      })
   })

   describe('Partner Role with Dynamic Condition Callback', () => {
      const rbac = new RbacEngine()

      // Register partner role with dynamic predicate
      rbac.registerRole({
         name: StandardRole.PARTNER,
         rules: [
            {
               action: ['read', 'update', 'create'],
               resource: 'companies/:targetCompany/*',
               // Dynamic resolver simulating getManagedCompanies
               condition: async (subject, context) => {
                  const managedCompanies = subject.managedCompanies || []
                  return managedCompanies.includes(context?.targetCompany)
               },
            },
         ],
      })

      const partnerSubject: RbacSubject = {
         uid: 'partner-1',
         role: StandardRole.PARTNER,
         managedCompanies: ['companies/c1', 'companies/c2'],
      }

      it('allows access to managed company via dynamic condition', async () => {
         const allowedC1 = await rbac.can(partnerSubject, 'read', 'companies/c1/medias', {
            targetCompany: 'companies/c1',
         })
         expect(allowedC1).toBe(true)

         const deniedC3 = await rbac.can(partnerSubject, 'read', 'companies/c3/medias', {
            targetCompany: 'companies/c3',
         })
         expect(deniedC3).toBe(false)
      })
   })

   describe('Privilege Non-Escalation (isSubsetOf)', () => {
      const rbac = new RbacEngine()

      rbac.registerRole({
         name: StandardRole.ADMIN,
         rules: [
            {
               action: ['read', 'create', 'update'],
               resource: 'medias/*',
            },
            {
               action: 'execute',
               resource: 'oauth/token',
            },
         ],
      })

      const adminSubject: RbacSubject = {
         uid: 'admin-1',
         role: StandardRole.ADMIN,
      }

      it('allows granting subset of permissions', async () => {
         const requestedScopes = ['read:medias/*', 'execute:oauth/token']
         const check = await rbac.isSubsetOf(adminSubject, requestedScopes)

         expect(check.valid).toBe(true)
         expect(check.rejectedScopes).toEqual([])
      })

      it('rejects granting escalated permissions not held by creator', async () => {
         const requestedScopes = [
            'read:medias/*',
            'delete:medias/*', // Admin does not have delete
            '*:system/global',   // Admin does not have root system
         ]
         const check = await rbac.isSubsetOf(adminSubject, requestedScopes)

         expect(check.valid).toBe(false)
         expect(check.rejectedScopes).toContain('delete:medias/*')
         expect(check.rejectedScopes).toContain('*:system/global')
      })

      it('allows root to grant any scopes', async () => {
         const rootSubject: RbacSubject = { uid: 'root-1', role: StandardRole.ROOT }
         const check = await rbac.isSubsetOf(rootSubject, ['*:*', 'delete:everything'])

         expect(check.valid).toBe(true)
         expect(check.rejectedScopes).toEqual([])
      })
   })
})
