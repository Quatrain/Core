import { QuatrainDictionary } from '@quatrain/i18n'

/**
 * English translation dictionary mapping for Quatrain table and UI components.
 */
export const enDictionary: QuatrainDictionary = {
    table: {
        uid: 'Identifier',
        id: 'ID',
        status: 'Status',
        createdAt: 'Created At',
        createdBy: 'Created By',
        updatedAt: 'Updated At',
        updatedBy: 'Updated By',
        deletedAt: 'Deleted At',
        deletedBy: 'Deleted By',
        showMeta: 'Show system metadata columns',
        noData: 'No data available',
        rowsPerPage: 'Rows per page',
        searchPlaceholder: 'Search...',
        loading: 'Loading list data...'
    },
    statuses: {
        active: 'Active',
        approved: 'Approved',
        archived: 'Archived',
        blocked: 'Blocked',
        cancelled: 'Cancelled',
        completed: 'Completed',
        converting: 'Converting',
        created: 'Created',
        deletable: 'Deletable',
        deleted: 'Deleted',
        disabled: 'Disabled',
        done: 'Done',
        draft: 'Draft',
        downloading: 'Downloading',
        downloaded: 'Downloaded',
        download_ko: 'Download Failed',
        error: 'Error',
        expired: 'Expired',
        failed: 'Failed',
        generating: 'Generating',
        generated: 'Generated',
        in_progress: 'In Progress',
        ko: 'Failed',
        ok: 'OK',
        paused: 'Paused',
        pending: 'Pending',
        preparing: 'Preparing',
        processing: 'Processing',
        published: 'Published',
        queued: 'Queued',
        rejected: 'Rejected',
        running: 'Running',
        success: 'Success',
        suspended: 'Suspended',
        unknown: 'Unknown',
        updated: 'Updated',
        uploading: 'Uploading',
        uploaded: 'Uploaded',
        upload_ko: 'Upload Failed',
        validated: 'Validated',
        zipping: 'Archiving'
    },
    errors: {
        weak_password: 'Password is not complex enough',
    }
}

