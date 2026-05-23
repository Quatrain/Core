export const ACTIVE = 'active'
export const APPROVED = 'approved'
export const ARCHIVED = 'archived'
export const BLOCKED = 'blocked'
export const CANCELLED = 'cancelled'
export const COMPLETED = 'completed'
export const CONVERTING = 'converting'
export const CREATED = 'created'
export const DELETABLE = 'deletable'
export const DELETED = 'deleted'
export const DISABLED = 'disabled'
export const DONE = 'done'
export const DRAFT = 'draft'
export const DOWNLOADING = 'downloading'
export const DOWNLOADED = 'downloaded'
export const DOWNLOAD_KO = 'download_ko'
export const ERROR = 'error'
export const EXPIRED = 'expired'
export const FAILED = 'failed'
export const GENERATING = 'generating'
export const GENERATED = 'generated'
export const IN_PROGRESS = 'in_progress'
export const KO = 'ko'
export const OK = 'ok'
export const PAUSED = 'paused'
export const PENDING = 'pending'
export const PREPARING = 'preparing'
export const PROCESSING = 'processing'
export const PUBLISHED = 'published'
export const QUEUED = 'queued'
export const REJECTED = 'rejected'
export const RUNNING = 'running'
export const SUCCESS = 'success'
export const SUSPENDED = 'suspended'
export const UNKNOWN = 'unknown'
export const UPDATED = 'updated'
export const UPLOADING = 'uploading'
export const UPLOADED = 'uploaded'
export const UPLOAD_KO = 'upload_ko'
export const VALIDATED = 'validated'
export const ZIPPING = 'zipping'

/**
 * Grouped statuses related to download operations.
 */
export const DOWNLOAD = {
   STARTED: DOWNLOADING,
   FINISHED: DOWNLOADED,
   OK: DOWNLOADED,
   KO: DOWNLOAD_KO,
} as const

/**
 * Grouped statuses related to upload operations.
 */
export const UPLOAD = {
   STARTED: UPLOADING,
   FINISHED: UPLOADED,
   OK: UPLOADED,
   KO: UPLOAD_KO,
} as const

/**
 * Grouped statuses related to document lifecycles and workflows.
 */
export const DOCUMENT = {
   DRAFT: DRAFT,
   PENDING: PENDING,
   APPROVED: APPROVED,
   REJECTED: REJECTED,
   PUBLISHED: PUBLISHED,
   ARCHIVED: ARCHIVED,
} as const



