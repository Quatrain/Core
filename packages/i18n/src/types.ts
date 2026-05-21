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

export interface QuatrainDictionary {
    /** Table/List specific labels */
    table: SystemTableLabels

    /** Additional dynamic namespaces and scopes */
    [key: string]: any
}
