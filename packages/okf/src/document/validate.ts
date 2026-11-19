/**
 * @quatrain/okf - validate
 * @description Checks an OKF v0.2 concept against the specification and an application profile
 * @license AGPL-3.0-only
 */

import { isOkfDatetime, okfVerifications, parseOkfActor } from './provenance'
import {
   OKF_STATUSES,
   OkfDocumentInterface,
   OkfFrontmatterInterface,
} from './types'

/** A rule a document breaks. */
export interface OkfIssueInterface {
   /** `error` breaks the specification or the profile; `warning` is advice. */
   severity: 'error' | 'warning'
   /** Key concerned, with a dotted path for nested values (`sources.0.resource`). */
   key: string
   message: string
}

/**
 * Stricter rules of an application on top of the specification.
 */
export interface OkfProfileInterface {
   /** Keys every concept must carry, with a value that is not empty. */
   required?: string[]
   /** Refuses keys whose value is an empty string, an empty list or `null`. */
   forbidEmpty?: boolean
   /**
    * Refuses the v0.1 keys superseded in v0.2 (`timestamp`, a body
    * `# Citations` list) instead of warning about them.
    */
   forbidLegacy?: boolean
   /** Rules of the application, run after those of the specification. */
   rules?: ((document: OkfDocumentInterface) => OkfIssueInterface[])[]
}

const CITATIONS = /^#{1,6}[ \t]+Citations[ \t]*$/im

function isEmpty(value: unknown): boolean {
   return (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
   )
}

function checkDatetime(
   issues: OkfIssueInterface[],
   key: string,
   value: unknown
): void {
   if (value !== undefined && !isOkfDatetime(value)) {
      issues.push({
         severity: 'error',
         key,
         message: 'must be an ISO 8601 datetime with an explicit UTC offset',
      })
   }
}

function checkActor(
   issues: OkfIssueInterface[],
   key: string,
   value: unknown
): void {
   if (parseOkfActor(value) === undefined) {
      issues.push({
         severity: 'error',
         key,
         message:
            'must be an actor: human:<id>, process:<id> or <producer>/<version>',
      })
   }
}

function specificationIssues(
   document: OkfDocumentInterface,
   profile: OkfProfileInterface
): OkfIssueInterface[] {
   const issues: OkfIssueInterface[] = []
   const frontmatter: OkfFrontmatterInterface = document.frontmatter
   if (typeof frontmatter.type !== 'string' || frontmatter.type.trim() === '') {
      issues.push({ severity: 'error', key: 'type', message: 'is required' })
   }
   if (
      frontmatter.status !== undefined &&
      !(OKF_STATUSES as readonly unknown[]).includes(frontmatter.status)
   ) {
      issues.push({
         severity: 'error',
         key: 'status',
         message: `must be one of ${OKF_STATUSES.join(', ')}`,
      })
   }
   if (
      frontmatter.tags !== undefined &&
      !(
         Array.isArray(frontmatter.tags) &&
         frontmatter.tags.every((tag) => typeof tag === 'string')
      )
   ) {
      issues.push({
         severity: 'error',
         key: 'tags',
         message: 'must be a list of strings',
      })
   }
   if (frontmatter.generated !== undefined) {
      const generated = frontmatter.generated as unknown
      if (generated === null || typeof generated !== 'object') {
         issues.push({
            severity: 'error',
            key: 'generated',
            message: 'must be a mapping { by, at }',
         })
      } else {
         checkActor(issues, 'generated.by', frontmatter.generated.by)
         checkDatetime(issues, 'generated.at', frontmatter.generated.at)
      }
   }
   okfVerifications(frontmatter).forEach((entry, index) => {
      if (entry === null || typeof entry !== 'object') {
         issues.push({
            severity: 'error',
            key: `verified.${index}`,
            message: 'must be a mapping { by, at }',
         })
         return
      }
      checkActor(issues, `verified.${index}.by`, entry.by)
      if (entry.at === undefined) {
         issues.push({
            severity: 'error',
            key: `verified.${index}.at`,
            message: 'is required',
         })
      } else {
         checkDatetime(issues, `verified.${index}.at`, entry.at)
      }
   })
   checkDatetime(issues, 'stale_after', frontmatter.stale_after)
   if (frontmatter.sources !== undefined) {
      if (!Array.isArray(frontmatter.sources)) {
         issues.push({
            severity: 'error',
            key: 'sources',
            message: 'must be a list',
         })
      } else {
         const ids = new Set<string>()
         frontmatter.sources.forEach((source, index) => {
            if (source === null || typeof source !== 'object') {
               issues.push({
                  severity: 'error',
                  key: `sources.${index}`,
                  message: 'must be a mapping',
               })
               return
            }
            if (
               typeof source.resource !== 'string' ||
               source.resource.trim() === ''
            ) {
               issues.push({
                  severity: 'error',
                  key: `sources.${index}.resource`,
                  message: 'is required',
               })
            }
            if (source.author !== undefined) {
               checkActor(issues, `sources.${index}.author`, source.author)
            }
            checkDatetime(
               issues,
               `sources.${index}.last_modified`,
               source.last_modified
            )
            if (typeof source.id === 'string') {
               if (ids.has(source.id)) {
                  issues.push({
                     severity: 'error',
                     key: `sources.${index}.id`,
                     message: 'is used by another source',
                  })
               }
               ids.add(source.id)
            }
         })
      }
   }
   const legacy = profile.forbidLegacy ? 'error' : 'warning'
   if (frontmatter.timestamp !== undefined) {
      issues.push({
         severity: legacy,
         key: 'timestamp',
         message: 'is superseded by generated.at in OKF v0.2',
      })
   }
   if (CITATIONS.test(document.body)) {
      issues.push({
         severity: legacy,
         key: 'body',
         message: 'a # Citations list is superseded by sources in OKF v0.2',
      })
   }
   return issues
}

function profileIssues(
   document: OkfDocumentInterface,
   profile: OkfProfileInterface
): OkfIssueInterface[] {
   const issues: OkfIssueInterface[] = []
   for (const key of profile.required ?? []) {
      if (key !== 'type' && isEmpty(document.frontmatter[key])) {
         issues.push({ severity: 'error', key, message: 'is required' })
      }
   }
   if (profile.forbidEmpty) {
      for (const [key, value] of Object.entries(document.frontmatter)) {
         if (isEmpty(value) && !(profile.required ?? []).includes(key)) {
            issues.push({
               severity: 'error',
               key,
               message: 'is empty: leave the key out instead',
            })
         }
      }
   }
   for (const rule of profile.rules ?? []) {
      issues.push(...rule(document))
   }
   return issues
}

/**
 * Checks a concept against the producer-side rules of OKF v0.2 and, when given,
 * an application profile. A consumer should not reject a document for the issues
 * of the specification alone (§11); a producer should not write one that has
 * errors.
 *
 * @param document - Parsed concept.
 * @param profile - Stricter rules of the application.
 * @returns The issues found, errors and warnings; empty when the document follows
 *    every rule.
 */
export function validateOkfDocument(
   document: OkfDocumentInterface,
   profile: OkfProfileInterface = {}
): OkfIssueInterface[] {
   return [
      ...specificationIssues(document, profile),
      ...profileIssues(document, profile),
   ]
}
