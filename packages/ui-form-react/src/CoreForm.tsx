import React from 'react'
import { TextInput, NumberInput, Checkbox, Button, Group, Title, Paper, Select, Stack, Divider, Text } from '@mantine/core'
import { useCoreForm } from './useCoreForm'

/**
 * Properties required by the CoreForm React component.
 */
export interface CoreFormProps {
    modelSchema: any
    objectId: string | undefined
    apiClient: any
    onSave: () => void
    onCancel: () => void
}

/**
 * A generic dynamic form component for Quatrain models using Mantine UI.
 * It renders fields based on the provided model schema and manages its state internally
 * via the useCoreForm hook and CoreFormManager.
 * 
 * @param props - The component properties conforming to CoreFormProps.
 * @returns A React functional component.
 */
export function CoreForm({ modelSchema, objectId, apiClient, onSave, onCancel }: CoreFormProps) {
    const { state, setFieldValue, save } = useCoreForm(modelSchema, objectId, apiClient)
    const { formData, relationOptions, status, validationErrors } = state

    const m = modelSchema.name
    const props = [...(modelSchema.properties || [])].sort((a: any, b: any) => {
        if (a.name === 'name') return -1;
        if (b.name === 'name') return 1;
        return 0;
    })
    const ignoredProps = ['id', 'status', 'createdat', 'updatedat', 'deletedat', 'createdby', 'updatedby', 'deletedby']

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await save()
            onSave()
        } catch (err) {
            // Error is handled in the manager state
        }
    }

    const renderField = (p: any) => {
        if (!p.name) return null
        const propName = p.name
        const lowerName = propName.toLowerCase()
        if (ignoredProps.includes(lowerName)) return null

        const isProtected = objectId !== 'new' && p.protected
        const fieldLabel = p.ui?.label || p.options?.instanceOf || propName

        if (p.type === 'StringProperty' || p.type === 'string') {
            return (
                <TextInput 
                    key={propName}
                    label={fieldLabel} 
                    value={formData[propName] || ''} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.target.value)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                    withAsterisk={p.mandatory}
                />
            )
        } else if (p.type === 'NumberProperty' || p.type === 'number') {
            return (
                <NumberInput 
                    key={propName}
                    label={fieldLabel} 
                    value={formData[propName] || 0} 
                    onChange={(val: string | number) => setFieldValue(propName, val)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                    withAsterisk={p.mandatory}
                />
            )
        } else if (p.type === 'BooleanProperty' || p.type === 'boolean') {
            return (
                <Checkbox 
                    key={propName}
                    label={fieldLabel} 
                    checked={formData[propName] || false} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.currentTarget.checked)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                    mt="xs"
                />
            )
        } else if (p.type === 'EnumProperty' || p.type === 'enum') {
            const enumValues = p.options?.values || p.options?.enum || []
            return (
                <Select 
                    key={propName}
                    label={fieldLabel} 
                    data={enumValues}
                    value={formData[propName] || ''} 
                    onChange={(val: string | null) => setFieldValue(propName, val)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                    withAsterisk={p.mandatory}
                />
            )
        } else if (p.type === 'DateTimeProperty' || p.type === 'datetime') {
            return (
                <TextInput 
                    key={propName}
                    type="datetime-local"
                    label={fieldLabel} 
                    value={formData[propName] || ''} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.target.value)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                    withAsterisk={p.mandatory}
                />
            )
        } else if (p.options?.instanceOf) {
            // Render relation select with autocomplete data
            return (
                <Select
                    key={propName}
                    label={fieldLabel}
                    data={relationOptions[propName] || []}
                    value={formData[propName] || ''}
                    onChange={(val: string | null) => setFieldValue(propName, val)}
                    searchable
                    clearable
                    filter={({ options, search }) => {
                        const s = search.toLowerCase().trim()
                        return (options as any[]).filter(opt => 
                            (opt as any)._search?.includes(s) || (opt as any).label.toLowerCase().includes(s)
                        )
                    }}
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                    withAsterisk={p.mandatory}
                />
            )
        } else {
            return (
                <TextInput 
                    key={propName}
                    label={fieldLabel + ' (' + p.type + ')'} 
                    value={formData[propName] || ''} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.target.value)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                    withAsterisk={p.mandatory}
                />
            )
        }
    }

    return (
        <Paper p="xl" radius="md" shadow="sm" withBorder>
            <Title order={3} mb="xs" fw={600}>
                {objectId === 'new' ? `Create ${m}` : `Edit ${m}`}
            </Title>
            <Text c="dimmed" size="sm" mb="xl">
                Fill in the information below to {objectId === 'new' ? 'create a new' : 'update this'} {m.toLowerCase()}.
            </Text>

            <form onSubmit={handleSubmit}>
                <Stack gap="md">
                    
                    {props.map((p: any) => renderField(p))}

                    <Divider my="sm" variant="dashed" />

                    <Select
                        label="Status"
                        description="Current lifecycle status of this object"
                        data={['created', 'pending', 'active', 'deleted']}
                        value={formData.status || 'created'}
                        onChange={(val: string | null) => setFieldValue('status', val)}
                        disabled={status === 'loading' || status === 'saving'}
                        radius="md"
                    />
                </Stack>

                <Group justify="flex-end" mt="xl">
                    <Button variant="subtle" color="gray" onClick={onCancel} disabled={status === 'loading' || status === 'saving'} radius="md">
                        Cancel
                    </Button>
                    <Button type="submit" loading={status === 'saving'} disabled={status === 'loading'} radius="md">
                        Save Changes
                    </Button>
                </Group>
            </form>
        </Paper>
    )
}
