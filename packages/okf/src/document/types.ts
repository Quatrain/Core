/**
 * @quatrain/okf - document types
 * @description Shapes of an OKF v0.2 concept document
 * @license AGPL-3.0-only
 */

/** Version of the Open Knowledge Format this module reads and writes. */
export const OKF_VERSION = '0.2'

/** File names with a defined meaning at any level of a bundle, never used for concepts. */
export const OKF_RESERVED_FILENAMES = ['index.md', 'log.md'] as const

/** Values of `status`; an absent `status` means `stable`. */
export const OKF_STATUSES = ['draft', 'stable', 'deprecated'] as const

export type OkfStatusType = (typeof OKF_STATUSES)[number]

/**
 * Who produced or confirmed content: `human:<id>`, `process:<id>`, or
 * `<producer>/<version>` for an agent or a tool.
 */
export type OkfActorType = string

/** A production or confirmation event. */
export interface OkfStampInterface {
   by: OkfActorType
   /** ISO 8601 datetime with an explicit UTC offset. */
   at?: string
}

/** A material a concept derives from. */
export interface OkfSourceInterface {
   /** URL, bundle path, `references/` path or scope descriptor. */
   resource: string
   /** Key used by footnotes to attribute a claim. */
   id?: string
   title?: string
   author?: OkfActorType
   usage_count?: number
   last_modified?: string
   [key: string]: unknown
}

/** Frontmatter of a concept: the keys of the specification, plus any extension. */
export interface OkfFrontmatterInterface {
   type: string
   title?: string
   description?: string
   resource?: string
   tags?: string[]
   sources?: OkfSourceInterface[]
   usage_window?: { from: string; to: string }
   generated?: OkfStampInterface
   /** Always a list once parsed; a bare mapping is read as one entry. */
   verified?: Required<OkfStampInterface>[]
   status?: OkfStatusType
   stale_after?: string
   [key: string]: unknown
}

/** A concept document: frontmatter and markdown body. */
export interface OkfDocumentInterface {
   frontmatter: OkfFrontmatterInterface
   /** Markdown after the closing `---`, as written. */
   body: string
}

/**
 * Raised when a text is not an OKF concept document: no frontmatter, YAML that
 * cannot be parsed, or frontmatter that is not a mapping.
 */
export class OkfFormatError extends Error {
   constructor(message: string) {
      super(message)
      this.name = 'OkfFormatError'
   }
}
