# HOWTO - Using @quatrain/ui-list-react

This guide details how to consume `@quatrain/ui-list-react` in your React applications. The package uses Mantine UI to generate gorgeous, responsive, and highly interactive data tables.

---

## Prerequisite: Mantine UI Provider

Ensure your React application is wrapped with the Mantine `<MantineProvider>` to ensure correct component theme and styling:

```tsx
import React from 'react'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css' // Required Mantine CSS styles

export default function App({ children }) {
    return (
        <MantineProvider defaultColorScheme="dark">
            {children}
        </MantineProvider>
    )
}
```

---

## 1. Simple Usage: Automatic Model-Driven Table Component

Automatically infer columns, property types, and pagination from a raw Quatrain core model definition.

```tsx
import React from 'react'
import { CoreList } from '@quatrain/ui-list-react'
import { User } from '@quatrain/core' // Quatrain Model
import { myApiClient } from './apiClient'

export function UserDirectoryTable() {
    return (
        <CoreList 
            options={{
                modelSchema: User,
                apiClient: myApiClient
            }}
            title="User Directory"
            lang="en" // Or "fr"
        />
    )
}
```

---

## 2. Medium Usage: Custom Configuration, Row Action Buttons, & Language Toggles

Configure columns manually, hide pagination or filtering, display system metadata switches, and declare contextual action buttons (e.g. modify / delete row entries).

```tsx
import React from 'react'
import { CoreList } from '@quatrain/ui-list-react'
import { Company } from '@quatrain/core'
import { myApiClient } from './apiClient'

export function CompanyDashboard() {
    // Custom button click router callback
    const handleActionClick = (actionKey: string, companyRow: any) => {
        console.log(`Action button '${actionKey}' clicked for company:`, companyRow.name)
    }

    const companyListConfig = {
        endpoint: 'companies',
        modelSchema: Company,
        defaultSorting: { field: 'createdAt', order: 'desc' },
        pagesize: 10,
        
        // Manual column maps
        columns: {
            name: { 
                label: { en: 'Company Name', fr: 'Nom' },
                sortable: true
            },
            email: { 
                label: 'Email Support',
                sortable: false
            },
            status: {
                label: 'Status',
                sortable: true
            }
        },
        
        // Custom row actions displayed on the right
        buttons: {
            edit: {
                label: { en: 'Modify', fr: 'Modifier' },
                options: { primary: true },
                action: (row: any) => {
                    window.location.hash = `/companies/${row.uid}/edit`
                }
            },
            delete: {
                label: { en: 'Delete', fr: 'Supprimer' },
                options: { negative: true },
                // Disable button conditionally based on state/roles
                disabled: (row: any) => row.status === 'deleted',
                action: async (row: any, { manager }) => {
                    if (confirm(`Delete company ${row.name}?`)) {
                        await myApiClient.delete(`companies/${row.uid}`)
                        manager.query() // Triggers real-time table reload
                    }
                }
            }
        }
    }

    return (
        <CoreList 
            options={{ config: companyListConfig, apiClient: myApiClient }}
            title="Managed Companies"
            lang="fr" // Display interface in French
            onRowAction={handleActionClick}
        />
    )
}
```

---

## 3. Complex Usage: Custom UI Filters with `useCoreList` Hook

Instead of using the default `<CoreList>` table component, you can consume the `useCoreList` hook directly to bind states to custom controls, external search inputs, checkbox forms, or entirely custom layouts.

```tsx
import React, { useState } from 'react'
import { useCoreList } from '@quatrain/ui-list-react'
import { Task } from '@quatrain/core'
import { 
    Table, 
    Pagination, 
    TextInput, 
    Checkbox, 
    Group, 
    Stack, 
    Loader, 
    Text, 
    Paper 
} from '@mantine/core'
import { myApiClient } from './apiClient'

export function CustomTaskList() {
    const [onlyUrgent, setOnlyUrgent] = useState(false)

    // 1. Initialize custom options with hook
    const { 
        state, 
        setPage, 
        setSorting, 
        setFilters 
    } = useCoreList({
        modelSchema: Task,
        apiClient: myApiClient,
        initialPageSize: 15,
        initialSorting: { field: 'dueDate', order: 'asc' }
    })

    const { items, status, page, pageSize, meta, sorting, filters } = state
    const totalCount = meta.count || items.length

    // 2. Handle search keyword input changes
    const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setFilters({
            ...filters,
            q: val || undefined
        })
    }

    // 3. Handle checkbox toggle filter changes
    const handleUrgentToggle = (checked: boolean) => {
        setOnlyUrgent(checked)
        setFilters({
            ...filters,
            priority: checked ? 'high' : undefined
        })
    }

    return (
        <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
                <Text size="lg" fw={700}>Project Tasks</Text>

                {/* Custom Filters Row */}
                <Group justify="space-between">
                    <TextInput 
                        placeholder="Filter by keyword..." 
                        onChange={handleKeywordChange}
                        style={{ width: 250 }}
                    />
                    <Checkbox 
                        label="Display only high priority tasks"
                        checked={onlyUrgent}
                        onChange={(e) => handleUrgentToggle(e.currentTarget.checked)}
                    />
                </Group>

                {/* Custom Styled Data List */}
                {status === 'loading' ? (
                    <Group justify="center" py="xl"><Loader color="teal" /></Group>
                ) : items.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">No matching tasks found.</Text>
                ) : (
                    <Table highlightOnHover striped>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th 
                                    onClick={() => setSorting({ 
                                        field: 'title', 
                                        order: sorting?.order === 'asc' ? 'desc' : 'asc' 
                                    })}
                                    style={{ cursor: 'pointer' }}
                                >
                                    Task Title {sorting?.field === 'title' ? (sorting.order === 'asc' ? '▲' : '▼') : '↕'}
                                </Table.Th>
                                <Table.Th>Assignee</Table.Th>
                                <Table.Th>Priority</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {items.map((task) => (
                                <Table.Tr key={task.uid}>
                                    <Table.Td fw={500}>{task.title}</Table.Td>
                                    <Table.Td>{task.assignee?.name || 'Unassigned'}</Table.Td>
                                    <Table.Td>{task.priority}</Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}

                {/* Custom Pagination Footer */}
                {totalCount > 0 && (
                    <Group justify="center" mt="md">
                        <Pagination 
                            value={page} 
                            onChange={setPage} 
                            total={Math.ceil(totalCount / pageSize)}
                            color="teal"
                        />
                    </Group>
                )}
            </Stack>
        </Paper>
    )
}
```
