/**
 * @quatrain/okf - provenance
 * @description Actors, trust tiers and lifecycle of OKF v0.2 concepts
 * @license AGPL-3.0-only
 */

import {
   OkfActorType,
   OkfFrontmatterInterface,
   OkfStampInterface,
} from './types'

/** Kind of an actor: a person, an automated process, or an agent or tool. */
export type OkfActorKindType = 'human' | 'process' | 'tool'

/** An actor split into its kind and its identifier. */
export interface OkfActorInterface {
   kind: OkfActorKindType
   /** Identifier after `human:` or `process:`, or `<producer>/<version>`. */
   id: string
}

/** Trust tiers, lowest to highest; derived from `verified`, never stored. */
export type OkfTrustTierType =
   'unverified' | 'machine-confirmed' | 'human-reviewed'

const PREFIXED = /^(human|process):(\S+)$/
const TOOL = /^[^\s/:]+\/\S+$/
const DATETIME =
   /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/

/**
 * Reads an actor.
 *
 * @param actor - `human:<id>`, `process:<id>` or `<producer>/<version>`.
 * @returns Its kind and identifier, or `undefined` when it follows none of these forms.
 */
export function parseOkfActor(actor: unknown): OkfActorInterface | undefined {
   if (typeof actor !== 'string') {
      return undefined
   }
   const prefixed = PREFIXED.exec(actor)
   if (prefixed) {
      return { kind: prefixed[1] as 'human' | 'process', id: prefixed[2] }
   }
   if (TOOL.test(actor)) {
      return { kind: 'tool', id: actor }
   }
   return undefined
}

/**
 * Tells whether a value is an ISO 8601 datetime with an explicit UTC offset, as
 * every datetime of OKF must be.
 */
export function isOkfDatetime(value: unknown): value is string {
   return (
      typeof value === 'string' &&
      DATETIME.test(value) &&
      !Number.isNaN(Date.parse(value))
   )
}

/** Datetime of an instant, in the form OKF expects (UTC, seconds). */
export function okfDatetime(instant: Date = new Date()): string {
   return instant.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Derives the trust tier of a concept from its verifications.
 *
 * @returns `human-reviewed` when a `human:` actor confirmed it,
 *    `machine-confirmed` when only other actors did, `unverified` otherwise.
 */
export function okfTrustTier(
   frontmatter: Pick<OkfFrontmatterInterface, 'verified'>
): OkfTrustTierType {
   const verified = okfVerifications(frontmatter)
   if (verified.length === 0) {
      return 'unverified'
   }
   return verified.some((entry) => parseOkfActor(entry.by)?.kind === 'human')
      ? 'human-reviewed'
      : 'machine-confirmed'
}

/** Verifications of a concept as a list, a bare mapping counting as one. */
export function okfVerifications(
   frontmatter: Pick<OkfFrontmatterInterface, 'verified'>
): OkfStampInterface[] {
   const verified = frontmatter.verified as unknown
   if (Array.isArray(verified)) {
      return verified
   }
   if (verified !== null && typeof verified === 'object') {
      return [verified as OkfStampInterface]
   }
   return []
}

/**
 * Tells whether a concept is stale: `now` is at or after its `stale_after`.
 */
export function isOkfStale(
   frontmatter: Pick<OkfFrontmatterInterface, 'stale_after'>,
   now: Date = new Date()
): boolean {
   if (!isOkfDatetime(frontmatter.stale_after)) {
      return false
   }
   return now.getTime() >= Date.parse(frontmatter.stale_after)
}

/**
 * Last meaningful change of a concept: `generated.at`, or a legacy v0.1
 * `timestamp` when `generated` is absent.
 */
export function okfLastChange(
   frontmatter: OkfFrontmatterInterface
): string | undefined {
   if (frontmatter.generated !== undefined) {
      return frontmatter.generated.at
   }
   const legacy = frontmatter.timestamp
   return typeof legacy === 'string' ? legacy : undefined
}

/**
 * Records who produced the current content, and when.
 *
 * @returns A copy of the frontmatter with `generated` set; any legacy `timestamp`
 *    is removed.
 */
export function withOkfGenerated<T extends OkfFrontmatterInterface>(
   frontmatter: T,
   by: OkfActorType,
   at: Date = new Date()
): T {
   const { timestamp: _legacy, ...rest } = frontmatter
   return { ...rest, generated: { by, at: okfDatetime(at) } } as T
}

/**
 * Records that an actor confirmed the content. A previous verification by the
 * same actor is replaced, so the list holds one entry per independent check.
 *
 * @returns A copy of the frontmatter with the verification added.
 */
export function withOkfVerification<T extends OkfFrontmatterInterface>(
   frontmatter: T,
   by: OkfActorType,
   at: Date = new Date()
): T {
   const others = okfVerifications(frontmatter).filter(
      (entry) => entry.by !== by
   )
   return {
      ...frontmatter,
      verified: [
         ...(others as Required<OkfStampInterface>[]),
         { by, at: okfDatetime(at) },
      ],
   }
}
