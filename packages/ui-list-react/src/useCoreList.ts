import { useEffect, useState, useMemo } from 'react'
import { CoreListManager, ListState, CoreListManagerOptions } from '@quatrain/ui-list'

/**
 * A React hook that binds to the framework-agnostic headless CoreListManager.
 * It automatically subscribes to list state changes and returns the list state along with operations.
 * 
 * @param options - Configuration options or exposer class target for the list manager.
 * @returns State and state-manipulating operations.
 */
export function useCoreList(options: CoreListManagerOptions) {
    // Prevent infinite render loops by stabilizing the options dependency array
    const stableOptions = useMemo(() => options, [
        options.endpoint,
        options.listClass,
        options.modelSchema,
        options.fetchFunction,
        options.apiClient,
        options.initialPage,
        options.initialPageSize,
        options.initialSorting,
        options.initialFilters
    ])

    const manager = useMemo(() => new CoreListManager(stableOptions), [stableOptions])

    const [state, setState] = useState<ListState>({
        items: [],
        meta: {},
        relationOptions: {},
        status: 'idle',
        error: null,
        page: 1,
        pageSize: 20,
        sorting: null,
        filters: {}
    })

    useEffect(() => {
        const unsubscribe = manager.subscribe((newState: ListState) => {
            setState(newState)
        })
        manager.init()
        return unsubscribe
    }, [manager])

    return {
        state,
        manager,
        setPage: manager.setPage.bind(manager),
        setPageSize: manager.setPageSize.bind(manager),
        setSorting: manager.setSorting.bind(manager),
        setFilters: manager.setFilters.bind(manager),
        reload: manager.query.bind(manager)
    }
}
