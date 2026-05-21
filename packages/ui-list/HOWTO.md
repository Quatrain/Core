# HOWTO - Using @quatrain/ui-list

This document presents simple, medium, and complex usage scenarios of the headless, framework-agnostic `@quatrain/ui-list` package.

---

## 1. Simple Usage: Automatic Model-Driven Collection Mapping

If you have a Quatrain model schema (with `PROPS_DEFINITION` or `properties`), the manager can automatically infer columns, pagination limits, and query targets.

```typescript
import { CoreListManager } from '@quatrain/ui-list'
import { User } from '@quatrain/core' // your Quatrain core model
import { myApiClient } from './apiClient'

// 1. Instantiate the manager using just the Quatrain model schema
const manager = new CoreListManager({
    modelSchema: User,
    apiClient: myApiClient,
    initialPageSize: 10
})

// 2. Subscribe to the reactive state
const unsubscribe = manager.subscribe((state) => {
    console.log('Status:', state.status)
    console.log('Total count:', state.meta.count)
    console.log('Items:', state.items)
})

// 3. Initialize and execute the query
await manager.init()

// Clean up listener when no longer needed
unsubscribe()
```

---

## 2. Medium Usage: Exposer Class Decorator Pattern (`@CoreList`)

Exposer classes represent list/table controller models in a domain-driven structure. Use the `@CoreList` class decorator to link metadata schemas and pre-fetch multilingual relationship labels (e.g. translating target references).

### Define the Exposer Class

```typescript
import { CoreList } from '@quatrain/ui-list'
import { Company } from '@quatrain/core'

@CoreList({
    endpoint: 'companies',
    modelSchema: Company,
    defaultSorting: { field: 'name', order: 'asc' },
    pagesize: 25,
    columns: {
        name: { 
            label: { fr: 'Nom de Société', en: 'Company Name' },
            sortable: true
        },
        email: { 
            label: 'Email',
            sortable: false
        },
        createdAt: { 
            label: 'Créé le',
            sortable: true
        }
    }
})
export class CompanyListExposer {
    // Write custom domain logic or filters here
}
```

### Consume the Decorated Exposer

```typescript
import { CoreListManager } from '@quatrain/ui-list'
import { CompanyListExposer } from './CompanyListExposer'
import { myApiClient } from './apiClient'

const manager = new CoreListManager({
    listClass: CompanyListExposer,
    apiClient: myApiClient
})

// Initialize the list manager (pre-fetches relations like status lists and executes query)
await manager.init()

// Navigate, paginate, sort, or filter the collection dynamically
manager.setPage(2)
manager.setSorting({ field: 'createdAt', order: 'desc' })
manager.setFilters({ status: 'active' })
```

---

## 3. Complex Usage: Custom Queries & Custom Fetch Function Overrides

For advanced needs, such as integrating compound search strings, handling non-standard query structures, or fetching data through nested RPC operations, override the querying channel using `fetchFunction`.

```typescript
import { CoreListManager, ListState } from '@quatrain/ui-list'
import { Project } from '@quatrain/core'

// Imagine we need a list displaying projects, but it requires a custom payload
const manager = new CoreListManager({
    modelSchema: Project,
    initialPage: 1,
    initialPageSize: 50,
    initialSorting: { field: 'priority', order: 'desc' },
    
    // Custom fetch override replacing direct REST calls
    fetchFunction: async (params: {
        offset: number
        batch: number
        q: Record<string, any>
        fsort?: string
        osort?: 'asc' | 'desc'
    }) => {
        // Translate state queries to custom back-end RPC commands
        const advancedPayload = {
            pagination: {
                skip: params.offset,
                limit: params.batch
            },
            sortRules: params.fsort ? [{ column: params.fsort, direction: params.osort }] : [],
            searchQuery: params.q.q || '',
            statusFilter: params.q.status || 'all'
        }

        // Execute fetch via custom client
        const response = await fetch('/api/rpc/projects/list-active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(advancedPayload)
        })
        
        if (!response.ok) {
            throw new Error(`RPC query failed: ${response.statusText}`)
        }

        const payload = await response.json()
        
        // Return standard Quatrain items & meta shape
        return {
            items: payload.records, // array of items
            meta: {
                count: payload.totalCount, // absolute total for pagination
                activeCount: payload.activeCount
            }
        }
    }
})

// Reacting to query progress
manager.subscribe((state: ListState) => {
    if (state.status === 'loading') {
        console.log('Querying RPC service...')
    } else if (state.status === 'error') {
        console.error('Failed to load projects:', state.error)
    } else {
        console.log(`Loaded ${state.items.length}/${state.meta.count} projects.`)
    }
})

// Trigger query
await manager.init()

// Apply compound search terms that get processed by your custom fetcher
manager.setFilters({ q: 'Search query', status: 'pending' })
```
