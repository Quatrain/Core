import { InvalidIdentifierError } from './errors'

/** Longest slug accepted: the length of a DNS label, so a slug can be a subdomain. */
export const SLUG_MAX_LENGTH = 63

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Tells whether a value is a slug: 1 to 63 characters of `a-z`, `0-9` and inner hyphens.
 * Such a value is safe in a URL path, a file name and a DNS label.
 *
 * @param value - Candidate slug.
 * @returns True when the value is a slug.
 */
export function isSlug(value: unknown): value is string {
   return typeof value === 'string' && SLUG.test(value)
}

/**
 * @param value - Candidate slug.
 * @param label - Name used in the error message.
 * @throws InvalidIdentifierError when the value is not a slug.
 */
export function assertSlug(value: unknown, label = 'A slug'): asserts value is string {
   if (!isSlug(value)) {
      throw new InvalidIdentifierError(`${label} is 1 to ${SLUG_MAX_LENGTH} characters of a-z, 0-9 and inner hyphens.`)
   }
}

/**
 * Options of {@link slugify}.
 */
export interface SlugifyOptionsInterface {
   /** Longest result, at most 63 (default 63). */
   maxLength?: number
}

function clampLength(maxLength: number | undefined): number {
   if (maxLength === undefined) {
      return SLUG_MAX_LENGTH
   }
   if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > SLUG_MAX_LENGTH) {
      throw new InvalidIdentifierError(`A slug length limit is an integer between 1 and ${SLUG_MAX_LENGTH}.`)
   }
   return maxLength
}

/**
 * Derives a slug from free text: accents are removed, letters lowered, and every run of other
 * characters becomes one hyphen.
 *
 * @param text - Title, name or any text.
 * @param options - Length limit.
 * @returns The slug, or an empty string when the text holds no Latin letter or digit —
 * callers decide the fallback (an identifier, a counter).
 */
export function slugify(text: string, options: SlugifyOptionsInterface = {}): string {
   const maxLength = clampLength(options.maxLength)
   if (typeof text !== 'string') {
      throw new InvalidIdentifierError('Only a string can be turned into a slug.')
   }
   return text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[æÆ]/g, 'ae')
      .replace(/[œŒ]/g, 'oe')
      .replace(/[øØ]/g, 'o')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, maxLength)
      .replace(/-+$/, '')
}

/**
 * Options of {@link uniqueSlug}.
 */
export interface UniqueSlugOptionsInterface extends SlugifyOptionsInterface {
   /** Number of candidates tried before giving up (default 100). */
   maxAttempts?: number
}

/**
 * Finds a free slug by appending a counter: `report`, `report-2`, `report-3`…
 * The base is shortened when needed so the result never exceeds the length limit.
 *
 * The check and the later write are two steps: under concurrency two callers can receive the same
 * slug. Keep a unique constraint in the storage and retry on conflict.
 *
 * @param base - Wanted slug.
 * @param isTaken - Tells whether a candidate is already used.
 * @param options - Length limit and number of attempts.
 * @returns The first free candidate.
 * @throws InvalidIdentifierError when the base is not a slug or no candidate is free.
 */
export async function uniqueSlug(base: string, isTaken: (candidate: string) => boolean | Promise<boolean>, options: UniqueSlugOptionsInterface = {}): Promise<string> {
   const maxLength = clampLength(options.maxLength)
   const maxAttempts = options.maxAttempts ?? 100
   assertSlug(base, 'The base slug')
   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const suffix = attempt === 1 ? '' : `-${attempt}`
      const candidate = `${base.slice(0, maxLength - suffix.length).replace(/-+$/, '')}${suffix}`
      if (isSlug(candidate) && !(await isTaken(candidate))) {
         return candidate
      }
   }
   throw new InvalidIdentifierError(`No free slug found for "${base}" after ${maxAttempts} attempts.`)
}
