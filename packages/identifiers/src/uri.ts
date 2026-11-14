const SCHEME = /^[a-z][a-z0-9+.-]*$/

/**
 * Tells whether a value is an absolute URI, optionally of an allowed scheme.
 * Use it before storing or following a link received from outside: passing the allowed schemes
 * keeps `javascript:`, `file:` and the like out.
 *
 * @param value - Candidate URI.
 * @param schemes - Allowed schemes without colon (`['https', 'okf']`); any scheme when omitted.
 * @returns True when the value parses as an absolute URI of an allowed scheme.
 */
export function isUri(value: unknown, schemes?: readonly string[]): value is string {
   if (typeof value !== 'string' || value === '' || /\s/.test(value)) {
      return false
   }
   let scheme: string
   try {
      scheme = new URL(value).protocol.slice(0, -1).toLowerCase()
   } catch {
      return false
   }
   if (!SCHEME.test(scheme)) {
      return false
   }
   return schemes === undefined || schemes.some((allowed) => allowed.toLowerCase() === scheme)
}
