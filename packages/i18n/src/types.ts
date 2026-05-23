/**
 * Standard labels and translations dictionary scope for interactive UI lists and data tables.
 */
export interface SystemTableLabels {
    /** Label for the unique identifier column header */
    uid: string
    
    /** Label for generic numeric or simple ID column header */
    id: string
    
    /** Label for model status badges column header */
    status: string
    
    /** Label for record creation timestamp column header */
    createdAt: string
    
    /** Label for record creator username/ID column header */
    createdBy: string
    
    /** Label for record last modification timestamp column header */
    updatedAt: string
    
    /** Label for record last updater username/ID column header */
    updatedBy: string
    
    /** Label for soft-delete deletion timestamp column header */
    deletedAt: string
    
    /** Label for soft-delete deleter username/ID column header */
    deletedBy: string
    
    /** Label for the switch toggle that includes/excludes system metadata columns */
    showMeta: string
    
    /** Message string displayed when a table/query is empty and returns no rows */
    noData: string
    
    /** Label for the lines limit selector choice */
    rowsPerPage: string
    
    /** Placeholder text shown inside the generic search input field */
    searchPlaceholder: string
    
    /** Message text shown inside the loading overlay when fetching data */
    loading: string
}

export interface SystemStatusesLabels {
    /** Label for active status */
    active: string
    /** Label for approved status */
    approved: string
    /** Label for archived status */
    archived: string
    /** Label for blocked status */
    blocked: string
    /** Label for cancelled status */
    cancelled: string
    /** Label for completed status */
    completed: string
    /** Label for converting status */
    converting: string
    /** Label for created status */
    created: string
    /** Label for deletable status */
    deletable: string
    /** Label for deleted status */
    deleted: string
    /** Label for disabled status */
    disabled: string
    /** Label for done status */
    done: string
    /** Label for draft status */
    draft: string
    /** Label for downloading status */
    downloading: string
    /** Label for downloaded status */
    downloaded: string
    /** Label for download_ko status */
    download_ko: string
    /** Label for error status */
    error: string
    /** Label for expired status */
    expired: string
    /** Label for failed status */
    failed: string
    /** Label for generating status */
    generating: string
    /** Label for generated status */
    generated: string
    /** Label for in_progress status */
    in_progress: string
    /** Label for ko status */
    ko: string
    /** Label for ok status */
    ok: string
    /** Label for paused status */
    paused: string
    /** Label for pending status */
    pending: string
    /** Label for preparing status */
    preparing: string
    /** Label for processing status */
    processing: string
    /** Label for published status */
    published: string
    /** Label for queued status */
    queued: string
    /** Label for rejected status */
    rejected: string
    /** Label for running status */
    running: string
    /** Label for success status */
    success: string
    /** Label for suspended status */
    suspended: string
    /** Label for unknown status */
    unknown: string
    /** Label for updated status */
    updated: string
    /** Label for uploading status */
    uploading: string
    /** Label for uploaded status */
    uploaded: string
    /** Label for upload_ko status */
    upload_ko: string
    /** Label for validated status */
    validated: string
    /** Label for zipping status */
    zipping: string
}

export interface QuatrainDictionary {
    /** Table/List specific labels */
    table: SystemTableLabels

    /** Status translation labels */
    statuses?: SystemStatusesLabels

    /** Additional dynamic namespaces and scopes */
    [key: string]: any
}

