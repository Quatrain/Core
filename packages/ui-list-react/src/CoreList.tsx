import React, { useState } from 'react'
import { 
    Table, 
    Pagination, 
    Loader, 
    Select, 
    TextInput, 
    Switch, 
    Button, 
    Group, 
    Stack, 
    Paper, 
    Text, 
    Badge, 
    Box, 
    Tooltip
} from '@mantine/core'
import { useCoreList } from './useCoreList'
import { CoreListManagerOptions } from '@quatrain/ui-list'
import { Translator } from '@quatrain/i18n'
import { enDictionary } from '@quatrain/i18n-en'
import { frDictionary } from '@quatrain/i18n-fr'

/**
 * Interface representing customizable styling and behavior props for CoreList.
 */
export interface CoreListProps {
    /** Instantiation options passed directly to CoreListManager */
    options: CoreListManagerOptions
    
    /** Optional title header displayed on top of the list */
    title?: string
    
    /** Optional active language code (defaults to English 'en' or French 'fr') */
    lang?: 'en' | 'fr'
    
    /** If true, the pagination block is completely hidden */
    hidePagination?: boolean
    
    /** If true, the search input filter block is completely hidden */
    hideFilters?: boolean
    
    /** Custom callbacks mapped to generic row action buttons */
    onRowAction?: (actionKey: string, row: any) => void
}

const translator = new Translator('en')
translator.register('en', enDictionary)
translator.register('fr', frDictionary)

const metaFieldNames = ['uid', 'id', 'status', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'deletedBy']

/**
 * A generic dynamic data table component for Quatrain models using Mantine UI.
 * Automatically handles pagination, real-time sorting, search filtering, and column parsing
 * from either direct configuration schemas or Core Model property definitions.
 * 
 * @param props - CoreListProps attributes.
 * @returns React functional component.
 */
export function CoreList({ 
    options, 
    title, 
    lang = 'en', 
    hidePagination = false, 
    hideFilters = false,
    onRowAction 
}: CoreListProps) {
    const { 
        state, 
        manager,
        setPage, 
        setPageSize, 
        setSorting, 
        setFilters 
    } = useCoreList(options)

    const [showMeta, setShowMeta] = useState<boolean>(false)
    const [searchTerm, setSearchTerm] = useState<string>('')

    const { items, meta, status, page, pageSize, sorting, filters } = state
    const config = manager.getConfig()
    
    const count = meta?.count ?? items.length

    // Resolve column structures
    let resolvedColumns: any[] = []
    
    if (config.columns) {
        // Formulated from direct list configuration object (like company-list.jsx)
        resolvedColumns = Object.entries(config.columns).map(([fieldName, colData]: [string, any]) => {
            return {
                name: fieldName,
                label: typeof colData.label === 'object' ? (colData.label[lang] || colData.label.en) : colData.label,
                accessor: colData.accessor,
                sortable: colData.sortable ?? true,
                options: colData.options || {},
                isMeta: metaFieldNames.includes(fieldName)
            }
        })
    } else if (config.modelSchema) {
        // Automatically extracted from model properties definitions
        const props: any[] = config.modelSchema.PROPS_DEFINITION || config.modelSchema.properties || []
        resolvedColumns = props.map((p: any) => {
            return {
                name: p.name,
                label: p.ui?.labels?.[lang] || p.ui?.label || p.name,
                sortable: true,
                isMeta: metaFieldNames.includes(p.name)
            }
        })
    }

    // Always ensure business properties are grouped first and sorted
    const businessCols = resolvedColumns.filter(c => !c.isMeta)
    const metaCols = resolvedColumns.filter(c => c.isMeta)

    // Columns actively displayed in table
    const displayedColumns = showMeta ? [...businessCols, ...metaCols] : businessCols

    const handleSort = (fieldName: string) => {
        if (!sorting || sorting.field !== fieldName) {
            setSorting({ field: fieldName, order: 'asc' })
        } else if (sorting.order === 'asc') {
            setSorting({ field: fieldName, order: 'desc' })
        } else {
            setSorting(null)
        }
    }

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setSearchTerm(val)
        
        // Simple search logic filtering on 'name' or 'email' or overall text matching
        const newFilters = { ...filters }
        if (val.trim()) {
            newFilters.q = val // Pass query parameter to filter API endpoint
        } else {
            delete newFilters.q
        }
        setFilters(newFilters)
    }

    // Dynamic value formatting helper
    const formatValue = (row: any, col: any) => {
        const val = row[col.name]
        
        if (col.accessor) {
            if (typeof col.accessor === 'function') {
                return col.accessor(row)
            }
            return row[col.accessor]
        }

        if (val === undefined || val === null) {
            return '-'
        }

        // System status fields badges formatting
        if (col.name === 'status') {
            const colors: Record<string, string> = {
                active: 'blue',
                created: 'gray',
                pending: 'yellow',
                deleted: 'red'
            }
            return <Badge color={colors[val] || 'teal'} variant="light">{String(val)}</Badge>
        }

        // Date values formatting
        if (val instanceof Date || (typeof val === 'string' && !Number.isNaN(Date.parse(val)) && (col.name.endsWith('At') || col.name === 'birthday'))) {
            return new Date(val).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        }

        // Boolean values checkmarks
        if (typeof val === 'boolean') {
            return val ? '✔️' : '❌'
        }

        return String(val)
    }

    // Row action button events mapper
    const handleButtonClick = (btnKey: string, btnConfig: any, row: any) => {
        if (btnConfig.action) {
            btnConfig.action(row, { manager, parent: null })
        }
        if (onRowAction) {
            onRowAction(btnKey, row)
        }
    }

    return (
        <Paper p="xl" radius="md" shadow="sm" withBorder style={{ position: 'relative' }}>
            <Stack gap="md">
                
                {/* Header Title Block */}
                {(title || config.modelSchema) && (
                    <Group justify="space-between">
                        <TitleBlock title={title || config.modelSchema?.name || 'List View'} count={count} />
                        
                        {metaCols.length > 0 && (
                            <Switch 
                                label={translator.translate('table', 'showMeta', lang)}
                                checked={showMeta}
                                onChange={(e) => setShowMeta(e.currentTarget.checked)}
                                size="sm"
                                color="teal"
                            />
                        )}
                    </Group>
                )}

                {/* Filter and search bar */}
                {!hideFilters && (
                    <TextInput 
                        placeholder={translator.translate('table', 'searchPlaceholder', lang)}
                        value={searchTerm}
                        onChange={handleSearchChange}
                        radius="md"
                        style={{ maxWidth: 400 }}
                    />
                )}

                {/* Table Data Layout */}
                <Box style={{ overflowX: 'auto', position: 'relative', minHeight: items.length === 0 ? '150px' : 'auto' }}>
                    <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
                        <Table.Thead>
                            <Table.Tr>
                                {displayedColumns.map(col => {
                                    const isActiveSort = sorting?.field === col.name
                                    const sortIcon = isActiveSort && sorting ? (sorting.order === 'asc' ? ' 🔼' : ' 🔽') : ''
                                    return (
                                        <Table.Th 
                                            key={col.name} 
                                            onClick={col.sortable !== false ? () => handleSort(col.name) : undefined}
                                            style={{ 
                                                cursor: col.sortable !== false ? 'pointer' : 'default',
                                                userSelect: 'none',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            <Group gap="xs">
                                                <Text size="sm" fw={600}>
                                                    {col.name === 'uid' || col.name === 'id' ? translator.translate('table', col.name, lang) : col.label}
                                                </Text>
                                                {col.sortable !== false && <span style={{ fontSize: '10px' }}>{sortIcon || ' ↕️'}</span>}
                                            </Group>
                                        </Table.Th>
                                    )
                                })}
                                {config.buttons && <Table.Th style={{ width: '150px' }}></Table.Th>}
                            </Table.Tr>
                        </Table.Thead>
                        
                        <Table.Tbody>
                            {status === 'loading' && items.length === 0 ? (
                                <Table.Tr>
                                    <Table.Td colSpan={displayedColumns.length + (config.buttons ? 1 : 0)}>
                                        <Stack align="center" py="xl" gap="xs">
                                            <Loader size="md" color="teal" />
                                            <Text c="dimmed" size="sm">{translator.translate('table', 'loading', lang)}</Text>
                                        </Stack>
                                    </Table.Td>
                                </Table.Tr>
                            ) : items.length === 0 ? (
                                <Table.Tr>
                                    <Table.Td colSpan={displayedColumns.length + (config.buttons ? 1 : 0)}>
                                        <Stack align="center" py="xl" gap="xs">
                                            <Text c="dimmed" size="sm">{translator.translate('table', 'noData', lang)}</Text>
                                        </Stack>
                                    </Table.Td>
                                </Table.Tr>
                            ) : (
                                items.map((row, index) => (
                                    <Table.Tr key={row.uid || row.id || index}>
                                        {displayedColumns.map(col => (
                                            <Table.Td key={col.name}>
                                                <Text size="sm">
                                                    {formatValue(row, col)}
                                                </Text>
                                            </Table.Td>
                                        ))}

                                        {/* Action buttons on the right */}
                                        {config.buttons && (
                                            <Table.Td>
                                                <Group justify="flex-end" gap="xs">
                                                    {Object.entries(config.buttons).map(([btnKey, btnConfig]: [string, any]) => {
                                                        // Check hidden status condition
                                                        if (btnConfig.hidden) {
                                                            if (btnConfig.hidden === true || (typeof btnConfig.hidden === 'function' && btnConfig.hidden(row, options))) {
                                                                return null
                                                            }
                                                        }
                                                        
                                                        const isDisabled = typeof btnConfig.disabled === 'function' ? btnConfig.disabled(row, options) : btnConfig.disabled
                                                        const labelText = typeof btnConfig.label === 'object' ? (btnConfig.label[lang] || btnConfig.label.en) : btnConfig.label
                                                        const color = btnConfig.options?.negative ? 'red' : (btnConfig.options?.primary ? 'blue' : 'gray')
                                                        
                                                        return (
                                                            <Tooltip key={btnKey} label={labelText} position="top" withArrow>
                                                                <Button 
                                                                    size="xs" 
                                                                    variant="light"
                                                                    color={color}
                                                                    disabled={isDisabled}
                                                                    onClick={() => handleButtonClick(btnKey, btnConfig, row)}
                                                                >
                                                                    {labelText}
                                                                </Button>
                                                            </Tooltip>
                                                        )
                                                    })}
                                                </Group>
                                            </Table.Td>
                                        )}
                                    </Table.Tr>
                                ))
                            )}
                        </Table.Tbody>
                    </Table>
                </Box>

                {/* Pagination Controls block */}
                {!hidePagination && count > 0 && (
                    <Group justify="space-between" mt="md">
                        <Group gap="xs">
                            <Text size="xs" c="dimmed">{translator.translate('table', 'rowsPerPage', lang)}</Text>
                            <Select 
                                value={String(pageSize)}
                                onChange={(val) => val && setPageSize(Number.parseInt(val, 10))}
                                data={['10', '20', '50', '100', '500']}
                                size="xs"
                                style={{ width: 80 }}
                            />
                        </Group>
                        <Pagination 
                            value={page}
                            onChange={setPage}
                            total={Math.ceil(count / pageSize)}
                            size="sm"
                            color="teal"
                        />
                    </Group>
                )}
            </Stack>
        </Paper>
    )
}

/**
 * Internal TitleBlock visual subcomponent
 */
function TitleBlock({ title, count }: { title: string, count: number }) {
    return (
        <Stack gap={0}>
            <Text size="lg" fw={700} c="dimmed" style={{ letterSpacing: '0.5px' }}>
                {title}
            </Text>
            <Text size="xs" c="dimmed">
                {count} {count > 1 ? 'items' : 'item'}
            </Text>
        </Stack>
    )
}
