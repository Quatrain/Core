import { AsyncLocalStorage } from 'node:async_hooks'
import { NoTenantScopeError, TenantScopeConflictError } from './errors'
import type { ScopeEnvelopeInterface, TenantInterface, TenantScopeInterface } from './types'

const storage = new AsyncLocalStorage<TenantScopeInterface>()

/**
 * Runs a function inside a tenant scope. Everything it awaits sees the same scope.
 * Re-entering the same tenant is allowed; entering another one is refused, because
 * switching tenant in the middle of a unit of work is how data crosses tenants.
 *
 * @param scope - Scope built by `Tenancy`.
 * @param fn - Work to run for the tenant.
 * @returns What `fn` returns.
 * @throws TenantScopeConflictError when a scope for another tenant is already open.
 */
export function runInTenant<T>(scope: TenantScopeInterface, fn: () => T): T {
   const open = storage.getStore()
   if (open && open.tenant.id !== scope.tenant.id) {
      throw new TenantScopeConflictError('A scope for another tenant is already open.')
   }
   return storage.run(scope, fn)
}

/**
 * @returns The open scope, or `undefined` outside any tenant scope.
 */
export function findCurrentScope(): TenantScopeInterface | undefined {
   return storage.getStore()
}

/**
 * @returns The open scope.
 * @throws NoTenantScopeError outside any tenant scope.
 */
export function currentScope(): TenantScopeInterface {
   const scope = storage.getStore()
   if (!scope) {
      throw new NoTenantScopeError('This code needs a tenant scope and none is open.')
   }
   return scope
}

/**
 * @returns The tenant of the open scope.
 * @throws NoTenantScopeError outside any tenant scope.
 */
export function currentTenant(): TenantInterface {
   return currentScope().tenant
}

/**
 * Reduces a scope to what a queue message or another process needs to reopen it.
 *
 * @param scope - Scope to serialise; the open one by default.
 * @returns The tenant identifier and the actor.
 */
export function scopeEnvelope(scope: TenantScopeInterface = currentScope()): ScopeEnvelopeInterface {
   return { tenant: scope.tenant.id, actor: scope.actor }
}
