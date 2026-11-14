/**
 * Base class of every error raised by the tenancy layer.
 */
export class TenancyError extends Error {
   constructor(message: string) {
      super(message)
      this.name = new.target.name
   }
}

/** The request names no tenant, or a tenant that does not exist. */
export class TenantNotFoundError extends TenancyError {}

/** The tenant exists but is suspended or archived. */
export class TenantUnavailableError extends TenancyError {}

/** The user holds no membership in the tenant. */
export class NotAMemberError extends TenancyError {}

/** Tenant-bound code ran outside any tenant scope. */
export class NoTenantScopeError extends TenancyError {}

/** A scope for another tenant was opened inside a tenant scope. */
export class TenantScopeConflictError extends TenancyError {}

/** The slug or identifier is already used by another tenant. */
export class TenantConflictError extends TenancyError {}

/** A slug, name, role, actor or manifest is malformed. */
export class InvalidTenantError extends TenancyError {}
