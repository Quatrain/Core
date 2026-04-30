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
    const props = modelSchema.properties || []
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

        if (p.type === 'StringProperty') {
            return (
                <TextInput 
                    key={propName}
                    label={propName} 
                    value={formData[propName] || ''} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.target.value)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                />
            )
        } else if (p.type === 'NumberProperty') {
            return (
                <NumberInput 
                    key={propName}
                    label={propName} 
                    value={formData[propName] || 0} 
                    onChange={(val: string | number) => setFieldValue(propName, val)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                />
            )
        } else if (p.type === 'BooleanProperty') {
            return (
                <Checkbox 
                    key={propName}
                    label={propName} 
                    checked={formData[propName] || false} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.currentTarget.checked)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                    mt="xs"
                />
            )
        } else if (p.type === 'EnumProperty') {
            const enumValues = p.options?.values || p.options?.enum || []
            return (
                <Select 
                    key={propName}
                    label={propName} 
                    data={enumValues}
                    value={formData[propName] || ''} 
                    onChange={(val: string | null) => setFieldValue(propName, val)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                />
            )
        } else if (p.type === 'DateTimeProperty') {
            return (
                <TextInput 
                    key={propName}
                    type="datetime-local"
                    label={propName} 
                    value={formData[propName] || ''} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.target.value)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
                />
            )
        } else if (p.options?.instanceOf) {
            // Render relation select with autocomplete data
            return (
                <Select
                    key={propName}
                    label={propName + ' (Relation)'}
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
                />
            )
        } else {
            return (
                <TextInput 
                    key={propName}
                    label={propName + ' (' + p.type + ')'} 
                    value={formData[propName] || ''} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.target.value)} 
                    disabled={status === 'loading' || status === 'saving' || isProtected}
                    error={validationErrors[propName]}
                    radius="md"
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
                    <TextInput 
                        label="Name" 
                        description={`Unique name identifier for this ${m.toLowerCase()}`}
                        value={formData.name || ''} 
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue('name', e.target.value)} 
                        disabled={status === 'loading' || status === 'saving'}
                        error={validationErrors['name']}
                        radius="md"
                        withAsterisk
                    />
                    
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
