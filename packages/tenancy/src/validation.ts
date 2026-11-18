import { isOpaqueId, isSlug } from '@quatrain/identifiers'
import { InvalidTenantError } from './errors'
import type { ActorType, CreateTenantInterface, TenantStatus, UpdateTenantInterface } from './types'

const STATUSES: readonly TenantStatus[] = ['active', 'suspended', 'archived']
const MAX_NAME_LENGTH = 200

/**
 * @param slug - Candidate slug.
 * @throws InvalidTenantError when the slug is malformed.
 */
export function assertSlug(slug: unknown): asserts slug is string {
   if (!isSlug(slug)) {
      throw new InvalidTenantError('A tenant slug is 1 to 63 characters of a-z, 0-9 and inner hyphens.')
   }
}

/**
 * Checks an opaque identifier (tenant or user).
 *
 * @param value - Candidate identifier.
 * @param label - Name used in the error message.
 * @throws InvalidTenantError when the identifier is empty, too long or holds control characters.
 */
export function assertIdentifier(value: unknown, label: string): asserts value is string {
   if (!isOpaqueId(value)) {
      throw new InvalidTenantError(`${label} must be a non-empty string of at most 200 characters without control characters.`)
   }
}

/**
 * Normalises a list of role names.
 *
 * @param roles - Role names.
 * @returns The roles, trimmed, without duplicates, sorted.
 * @throws InvalidTenantError when the list or one of its items is malformed.
 */
export function normaliseRoles(roles: unknown): string[] {
   if (!Array.isArray(roles)) {
      throw new InvalidTenantError('Roles must be an array of strings.')
   }
   const unique = new Set<string>()
   for (const role of roles) {
      if (typeof role !== 'string' || role.trim() === '') {
         throw new InvalidTenantError('A role must be a non-empty string.')
      }
      unique.add(role.trim())
   }
   return [...unique].sort()
}

/**
 * Checks an actor and tells users from system processes.
 *
 * @param actor - Actor given by the host.
 * @returns The user identifier, or `undefined` for a system actor.
 * @throws InvalidTenantError when the actor names neither, or an empty one.
 */
export function actorUser(actor: ActorType): string | undefined {
   const candidate = actor as { user?: unknown; system?: unknown } | null | undefined
   if (candidate && candidate.user !== undefined && candidate.system === undefined) {
      assertIdentifier(candidate.user, 'The acting user')
      return candidate.user
   }
   if (candidate && candidate.system !== undefined && candidate.user === undefined) {
      assertIdentifier(candidate.system, 'The acting system process')
      return undefined
   }
   throw new InvalidTenantError('An actor is either { user } or { system }.')
}

function assertName(name: unknown): asserts name is string {
   if (typeof name !== 'string' || name.trim() === '' || name.length > MAX_NAME_LENGTH) {
      throw new InvalidTenantError(`A tenant name is a non-empty string of at most ${MAX_NAME_LENGTH} characters.`)
   }
}

function assertStatus(status: unknown): asserts status is TenantStatus {
   if (!STATUSES.includes(status as TenantStatus)) {
      throw new InvalidTenantError(`A tenant status is one of: ${STATUSES.join(', ')}.`)
   }
}

function assertSettings(settings: unknown): asserts settings is Record<string, unknown> {
   if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      throw new InvalidTenantError('Tenant settings must be an object.')
   }
}

/**
 * Validates the values of a tenant creation. Shared by every store.
 *
 * @param input - Creation values.
 * @throws InvalidTenantError on the first malformed value.
 */
export function assertCreateTenant(input: CreateTenantInterface): void {
   assertSlug(input.slug)
   assertName(input.name)
   if (input.id !== undefined) {
      assertIdentifier(input.id, 'A tenant identifier')
   }
   if (input.status !== undefined) {
      assertStatus(input.status)
   }
   if (input.entity !== undefined) {
      assertIdentifier(input.entity, 'A tenant entity reference')
   }
   if (input.settings !== undefined) {
      assertSettings(input.settings)
   }
}

/**
 * Validates the values of a tenant update. Shared by every store.
 *
 * @param patch - Update values.
 * @throws InvalidTenantError on the first malformed value.
 */
export function assertUpdateTenant(patch: UpdateTenantInterface): void {
   if (patch.name !== undefined) {
      assertName(patch.name)
   }
   if (patch.status !== undefined) {
      assertStatus(patch.status)
   }
   if (patch.entity !== undefined && patch.entity !== null) {
      assertIdentifier(patch.entity, 'A tenant entity reference')
   }
   if (patch.settings !== undefined) {
      assertSettings(patch.settings)
   }
}
