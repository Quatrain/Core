/**
 * @quatrain/okf - upgrade
 * @description Brings an OKF v0.1 concept to v0.2
 * @license AGPL-3.0-only
 */

import { isOkfDatetime, okfDatetime } from './provenance'
import { OkfActorType, OkfDocumentInterface } from './types'

/** What an upgrade did. */
export interface OkfUpgradeResultInterface {
   document: OkfDocumentInterface
   /** Whether anything changed. */
   changed: boolean
   /** What could not be converted and is left for a person or a tool to handle. */
   remaining: string[]
}

const CITATIONS = /^#{1,6}[ \t]+Citations[ \t]*$/im

/**
 * Brings a v0.1 concept to v0.2: a `timestamp` becomes `generated: { by, at }`.
 * An existing `generated` is kept and the `timestamp` dropped. A body
 * `# Citations` list cannot be turned into `sources` reliably and is reported.
 *
 * @param document - Parsed concept.
 * @param options.by - Actor recorded as producer when a `timestamp` is converted,
 *    usually the process doing the upgrade.
 * @returns The upgraded document, whether it changed, and what remains.
 */
export function upgradeOkfDocument(
   document: OkfDocumentInterface,
   options: { by: OkfActorType }
): OkfUpgradeResultInterface {
   const { timestamp, ...rest } = document.frontmatter
   const remaining: string[] = []
   let changed = false
   const frontmatter = { ...rest }
   if (timestamp !== undefined) {
      changed = true
      if (frontmatter.generated === undefined) {
         const instant =
            typeof timestamp === 'string' || timestamp instanceof Date
               ? new Date(timestamp as string)
               : undefined
         if (instant !== undefined && !Number.isNaN(instant.getTime())) {
            const at = isOkfDatetime(timestamp)
               ? (timestamp as string)
               : okfDatetime(instant)
            frontmatter.generated = { by: options.by, at }
         } else {
            frontmatter.generated = { by: options.by }
            remaining.push(
               `timestamp ${JSON.stringify(timestamp)} is not a datetime and was dropped`
            )
         }
      }
   }
   if (CITATIONS.test(document.body)) {
      remaining.push('the body # Citations list should move to sources')
   }
   return {
      document: {
         frontmatter: frontmatter as OkfDocumentInterface['frontmatter'],
         body: document.body,
      },
      changed,
      remaining,
   }
}
