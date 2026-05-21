/**
 * Represents the internal state of the CoreListManager.
 */
export type ListState = {
    /** The active loaded rows */
    items: any[]
    
    /** Metadata dictionary (e.g. { count: 120 }) */
    meta: Record<string, any>
    
    /** Multilingual options list for relational fields mapped by property name */
    relationOptions: Record<string, { label: string, value: string, _search?: string }[]>
    
    /** Loading status of the manager query process */
    status: 'idle' | 'loading' | 'error'
    
    /** Error details if a query failed */
    error: any | null
    
    /** Active 1-indexed page number */
    page: number
    
    /** Number of rows visible per page */
    pageSize: number
    
    /** Active sorting criteria or null */
    sorting: { field: string, order: 'asc' | 'desc' } | null
    
    /** Active search filters mapped by property name */
    filters: Record<string, any>
}

/**
 * Options required when instantiating the CoreListManager.
 */
export interface CoreListManagerOptions {
    /** An exposer class decorated with @CoreList */
    listClass?: any
    
    /** Direct configuration object */
    config?: any
    
    /** Core model schema or definition class */
    modelSchema?: any
    
    /** Backend endpoint URL prefix */
    endpoint?: string
    
    /** Quatrain API client wrapper */
    apiClient?: any
    
    /** Custom loading callback taking query parameters and returning data */
    fetchFunction?: (params: any) => Promise<any>
    
    /** Initial visible page (defaults to 1) */
    initialPage?: number
    
    /** Initial lines batch size (defaults to 20 or config setting) */
    initialPageSize?: number
    
    /** Initial sorting configurations */
    initialSorting?: { field: string, order: 'asc' | 'desc' } | null
    
    /** Initial search filters map */
    initialFilters?: Record<string, any>
}

/**
 * Headless, framework-agnostic list and data table manager.
 * Orchestrates pagination, search filters, column headers, backend requests,
 * and relational ID resolution independently of visual renderings.
 */
export class CoreListManager {
    protected options: CoreListManagerOptions
    protected resolvedConfig: any = {}
    protected listeners: ((state: ListState) => void)[] = []
    
    protected state: ListState = {
        items: [],
        meta: {},
        relationOptions: {},
        status: 'idle',
        error: null,
        page: 1,
        pageSize: 20,
        sorting: null,
        filters: {}
    }

    /**
     * Initializes the CoreListManager with provided configurations.
     * 
     * @param options - Instantiation options containing classes, targets, or custom loader hooks.
     */
    constructor(options: CoreListManagerOptions) {
        this.options = options
        
        // Resolve configuration from class decorator if present, or direct config object, or model schema
        if (options.listClass && options.listClass.listConfig) {
            this.resolvedConfig = { ...options.listClass.listConfig }
        } else if (options.config) {
            this.resolvedConfig = { ...options.config }
        }

        // Overlay properties directly if specified
        if (options.modelSchema) {
            this.resolvedConfig.modelSchema = options.modelSchema
        }
        if (options.endpoint) {
            this.resolvedConfig.endpoint = options.endpoint
        }

        // Fallback endpoint name inference from model name if missing
        if (!this.resolvedConfig.endpoint && this.resolvedConfig.modelSchema) {
            const schemaName: string = this.resolvedConfig.modelSchema.name || ''
            if (schemaName) {
                this.resolvedConfig.endpoint = `${schemaName.toLowerCase()}s`
            }
        }

        // Set initial state fields
        const startPage: number = options.initialPage ?? 1
        const startPageSize: number = options.initialPageSize ?? this.resolvedConfig.pagesize ?? 20
        const startSorting: { field: string, order: 'asc' | 'desc' } | null = options.initialSorting ?? this.resolvedConfig.defaultSorting ?? null
        const startFilters: Record<string, any> = options.initialFilters ?? {}

        this.state = {
            ...this.state,
            page: startPage,
            pageSize: startPageSize,
            sorting: startSorting,
            filters: startFilters
        }
    }

    /**
     * Registers a subscriber callback that is notified when the internal state changes.
     * 
     * @param listener - The state change listener callback.
     * @returns An unsubscribe callback to clean up the registration.
     */
    public subscribe(listener: (state: ListState) => void): () => void {
        this.listeners.push(listener)
        listener({ ...this.state }) // Emit current state immediately
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    protected emit(): void {
        for (const listener of this.listeners) {
            listener({ ...this.state })
        }
    }

    protected patchState(partialState: Partial<ListState>): void {
        this.state = { ...this.state, ...partialState }
        this.emit()
    }

    /**
     * Initializes the manager by pre-loading options and relations, then running the initial query.
     */
    public async init(): Promise<void> {
        this.patchState({ status: 'loading', error: null })
        try {
            await this.fetchRelations()
            await this.query()
        } catch (e: any) {
            console.error('Failed to initialize list manager', e)
            this.patchState({ status: 'error', error: e })
        }
    }

    /**
     * Pre-fetches multilingual name labels for relational properties in the schema.
     */
    protected async fetchRelations(): Promise<void> {
        const modelSchema: any = this.resolvedConfig.modelSchema
        if (!modelSchema || !this.options.apiClient) return

        const props: any[] = modelSchema.PROPS_DEFINITION || modelSchema.properties || []
        const newRelationOptions: Record<string, { label: string, value: string, _search?: string }[]> = { ...this.state.relationOptions }
        
        const relationPromises = props.map(async (p: any) => {
            if (p.options?.instanceOf) {
                const targetModel: string = typeof p.options.instanceOf === 'string' ? p.options.instanceOf : p.type
                const url = `${targetModel.toLowerCase()}s/values`
                try {
                    const res = await this.options.apiClient.get(url)
                    if (res && res.data) {
                        const pattern: string | undefined = p.options?.pattern
                        const formattedData = res.data.map((item: any) => {
                            let label: string = item.name || item.value
                            if (pattern) {
                                label = pattern.replaceAll(/\$\{([^}]+)\}/g, (match: string, prop: string) => {
                                    return item[prop] !== undefined ? String(item[prop]) : match
                                })
                            }
                            return { label, value: item.value, _search: item._search || '' }
                        })
                        newRelationOptions[p.name] = formattedData
                    }
                } catch (e) {
                    console.error('Failed to load relation values for', p.name, e)
                }
            }
        })

        await Promise.all(relationPromises)
        this.patchState({ relationOptions: newRelationOptions })
    }

    /**
     * Triggers a query to populate or update the data rows using active sorting, page index, and filters.
     * 
     * @param page - Target page index.
     * @param pageSize - Lines batch limit size.
     * @param sorting - Column sorting rules.
     * @param filters - Columns value filter rules.
     */
    public async query(
        page: number = this.state.page,
        pageSize: number = this.state.pageSize,
        sorting: { field: string, order: 'asc' | 'desc' } | null = this.state.sorting,
        filters: Record<string, any> = this.state.filters
    ): Promise<void> {
        this.patchState({ status: 'loading', error: null })

        const q: Record<string, any> = {}
        for (const [key, val] of Object.entries(filters)) {
            if (val !== undefined && val !== null && val !== '') {
                q[key] = val.ref ? [val.ref, 'equals', 'ref'] : val
            }
        }

        const params: any = {
            offset: (page - 1) * pageSize,
            batch: pageSize,
            q,
            fsort: sorting ? sorting.field : undefined,
            osort: sorting ? sorting.order : undefined
        }

        try {
            let res: any
            if (this.resolvedConfig.actions?.list) {
                res = await this.resolvedConfig.actions.list(params)
            } else if (this.options.fetchFunction) {
                res = await this.options.fetchFunction(params)
            } else if (this.options.apiClient && this.resolvedConfig.endpoint) {
                res = await this.options.apiClient.get(this.resolvedConfig.endpoint, params)
            } else {
                throw new Error('No list action, fetchFunction, or apiClient + endpoint configured for loading list data.')
            }

            const items: any[] = res?.items || res?.data || []
            const meta: Record<string, any> = res?.meta || { count: items.length }

            // Dynamic mapping of ID references to relation labels using our preloaded relationOptions
            const modelSchema: any = this.resolvedConfig.modelSchema
            if (modelSchema) {
                const props: any[] = modelSchema.PROPS_DEFINITION || modelSchema.properties || []
                for (const row of items) {
                    for (const p of props) {
                        if (p.options?.instanceOf && row[p.name]) {
                            const relations = this.state.relationOptions[p.name] || []
                            const matched = relations.find((r: any) => r.value === row[p.name])
                            if (matched) {
                                row[`_${p.name}`] = row[p.name] // keep original UUID backup
                                row[p.name] = matched.label
                            }
                        }
                    }
                }
            }

            this.patchState({
                items,
                meta,
                page,
                pageSize,
                sorting,
                filters,
                status: 'idle'
            })
        } catch (e: any) {
            console.error('Failed to run query on list manager', e)
            this.patchState({ status: 'error', error: e })
        }
    }

    /**
     * Changes the visible page index and automatically triggers the fetch.
     * 
     * @param page - Target page index.
     */
    public setPage(page: number): void {
        this.query(page, this.state.pageSize, this.state.sorting, this.state.filters)
    }

    /**
     * Changes the items batch limit size and queries page 1.
     * 
     * @param pageSize - Lines batch limit size.
     */
    public setPageSize(pageSize: number): void {
        this.query(1, pageSize, this.state.sorting, this.state.filters)
    }

    /**
     * Updates column sorting rules and queries page 1.
     * 
     * @param sorting - Column sorting rules or null.
     */
    public setSorting(sorting: { field: string, order: 'asc' | 'desc' } | null): void {
        this.query(1, this.state.pageSize, sorting, this.state.filters)
    }

    /**
     * Updates active filters list and queries page 1.
     * 
     * @param filters - Active search filters map.
     */
    public setFilters(filters: Record<string, any>): void {
        this.query(1, this.state.pageSize, this.state.sorting, filters)
    }

    /**
     * Retrieves the resolved configuration parameters.
     * 
     * @returns The resolved configuration parameters.
     */
    public getConfig(): any {
        return this.resolvedConfig
    }
}
