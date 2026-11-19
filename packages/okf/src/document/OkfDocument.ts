/**
 * @quatrain/okf - OkfDocument
 * @description Reads and writes OKF v0.2 concept documents
 * @license AGPL-3.0-only
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import {
   OKF_RESERVED_FILENAMES,
   OkfDocumentInterface,
   OkfFormatError,
   OkfFrontmatterInterface,
} from './types'

const FRONTMATTER = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/** Order in which the keys of the specification are written; extensions follow. */
const KEY_ORDER = [
   'type',
   'title',
   'description',
   'resource',
   'tags',
   'status',
   'generated',
   'verified',
   'stale_after',
   'sources',
   'usage_window',
]

/**
 * Tells whether a file name holds a concept, that is a markdown file whose name is
 * not reserved.
 *
 * @param fileName - Base name of the file.
 */
export function isOkfConceptFile(fileName: string): boolean {
   const name = fileName.toLowerCase()
   return (
      name.endsWith('.md') &&
      !(OKF_RESERVED_FILENAMES as readonly string[]).includes(name)
   )
}

/**
 * Reads a concept document. Unknown keys are kept, in their order; a bare
 * `verified` mapping becomes a one-element list. The document is not validated:
 * see `validateOkfDocument`.
 *
 * @param text - Content of the markdown file.
 * @returns Its frontmatter and its body.
 * @throws OkfFormatError when there is no frontmatter, when its YAML cannot be
 *    parsed, or when it is not a mapping.
 */
export function parseOkfDocument(text: string): OkfDocumentInterface {
   const match = FRONTMATTER.exec(text)
   if (!match) {
      throw new OkfFormatError('The document has no frontmatter')
   }
   let data: unknown
   try {
      data = parseYaml(match[1])
   } catch (error) {
      throw new OkfFormatError(
         `The frontmatter is not valid YAML: ${(error as Error).message}`
      )
   }
   if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new OkfFormatError('The frontmatter is not a mapping')
   }
   const frontmatter = { ...(data as Record<string, unknown>) }
   const verified = frontmatter.verified
   if (
      verified !== null &&
      typeof verified === 'object' &&
      !Array.isArray(verified)
   ) {
      frontmatter.verified = [verified]
   }
   return {
      frontmatter: frontmatter as OkfFrontmatterInterface,
      body: text.slice(match[0].length),
   }
}

/**
 * Writes a concept document: the keys of the specification first, in a fixed
 * order, then the extensions in their order. Keys whose value is `undefined` or
 * `null` are left out. The body is written as given, so reading the result gives it
 * back unchanged; start it with a blank line to separate it from the frontmatter.
 *
 * @param document - Frontmatter and body.
 * @returns Content of the markdown file.
 */
export function serializeOkfDocument(document: OkfDocumentInterface): string {
   const ordered: Record<string, unknown> = {}
   const keys = [
      ...KEY_ORDER.filter((key) => key in document.frontmatter),
      ...Object.keys(document.frontmatter).filter(
         (key) => !KEY_ORDER.includes(key)
      ),
   ]
   for (const key of keys) {
      const value = document.frontmatter[key]
      if (value !== undefined && value !== null) {
         ordered[key] = value
      }
   }
   const yaml = stringifyYaml(ordered, { lineWidth: 0 })
   return `---\n${yaml}---\n${document.body}`
}
