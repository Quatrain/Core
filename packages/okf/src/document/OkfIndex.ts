/**
 * @quatrain/okf - OkfIndex
 * @description Writes the index.md files of an OKF bundle
 * @license AGPL-3.0-only
 */

import { stringify as stringifyYaml } from 'yaml'
import { OKF_VERSION } from './types'

/** One line of an index: a concept or a subdirectory. */
export interface OkfIndexEntryInterface {
   title: string
   /** Link, relative to the directory of the index (`guide.md`, `subdir/`). */
   href: string
   /** Usually the `description` of the linked concept. */
   description?: string
}

/** A group of entries under a heading. */
export interface OkfIndexSectionInterface {
   heading: string
   entries: OkfIndexEntryInterface[]
}

/**
 * How an index is written.
 */
export interface OkfIndexOptionsInterface {
   /**
    * Writes the `okf_version` frontmatter: only the index at the root of a bundle
    * may carry it. `true` writes the version of this module.
    */
   okfVersion?: boolean | string
   /** Text between the frontmatter and the first section, such as a title or a paragraph. */
   preamble?: string
}

function escapeLabel(text: string): string {
   return text
      .replace(/([\\\[\]])/g, '\\$1')
      .replace(/\s+/g, ' ')
      .trim()
}

function escapeHref(href: string): string {
   return href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')
}

/**
 * Writes an `index.md`: sections of `* [Title](href) - description` lines, with no
 * frontmatter except `okf_version` at the root of a bundle. Empty sections are left
 * out.
 *
 * @param sections - Groups of entries, in the order they appear.
 * @param options - Root frontmatter and preamble.
 * @returns Content of the index file.
 */
export function renderOkfIndex(
   sections: OkfIndexSectionInterface[],
   options: OkfIndexOptionsInterface = {}
): string {
   const parts: string[] = []
   if (options.okfVersion) {
      const version =
         options.okfVersion === true ? OKF_VERSION : options.okfVersion
      parts.push(`---\n${stringifyYaml({ okf_version: version })}---\n`)
   }
   if (options.preamble !== undefined && options.preamble.trim() !== '') {
      parts.push(`${options.preamble.trim()}\n`)
   }
   for (const section of sections) {
      if (section.entries.length === 0) {
         continue
      }
      const lines = section.entries.map((entry) => {
         const link = `* [${escapeLabel(entry.title)}](${escapeHref(entry.href)})`
         const description = entry.description?.replace(/\s+/g, ' ').trim()
         return description ? `${link} - ${description}` : link
      })
      parts.push(`# ${section.heading.trim()}\n\n${lines.join('\n')}\n`)
   }
   return parts.join('\n')
}
