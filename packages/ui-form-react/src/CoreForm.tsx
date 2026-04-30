import React from 'react'
import { TextInput, NumberInput, Checkbox, Button, Group, Title, Paper, Select } from '@mantine/core'
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
    const { formData, relationOptions, status } = state

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

        if (p.type === 'StringProperty') {
            return (
                <TextInput 
                    key={propName}
                    label={propName} 
                    value={formData[propName] || ''} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.target.value)} 
                    mb="sm" 
                    disabled={status === 'loading' || status === 'saving'}
                />
            )
        } else if (p.type === 'NumberProperty') {
            return (
                <NumberInput 
                    key={propName}
                    label={propName} 
                    value={formData[propName] || 0} 
                    onChange={(val: string | number) => setFieldValue(propName, val)} 
                    mb="sm" 
                    disabled={status === 'loading' || status === 'saving'}
                />
            )
        } else if (p.type === 'BooleanProperty') {
            return (
                <Checkbox 
                    key={propName}
                    label={propName} 
                    checked={formData[propName] || false} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.currentTarget.checked)} 
                    mb="sm" 
                    disabled={status === 'loading' || status === 'saving'}
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
                    mb="sm" 
                    disabled={status === 'loading' || status === 'saving'}
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
                    mb="sm" 
                    disabled={status === 'loading' || status === 'saving'}
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
                    mb="sm"
                    disabled={status === 'loading' || status === 'saving'}
                />
            )
        } else {
            return (
                <TextInput 
                    key={propName}
                    label={propName + ' (' + p.type + ')'} 
                    value={formData[propName] || ''} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue(propName, e.target.value)} 
                    mb="sm" 
                    disabled={status === 'loading' || status === 'saving'}
                />
            )
        }
    }

    return (
        <Paper p="md" shadow="sm">
            <Title order={2} mb="md">{objectId === 'new' ? `Create ${m}` : `Edit ${m}`}</Title>
            <form onSubmit={handleSubmit}>
                <TextInput 
                    label="Name" 
                    value={formData.name || ''} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldValue('name', e.target.value)} 
                    mb="sm" 
                    disabled={status === 'loading' || status === 'saving'}
                />
                
                {props.map((p: any) => renderField(p))}

                <Select
                    label="Status"
                    data={['created', 'pending', 'active', 'deleted']}
                    value={formData.status || 'created'}
                    onChange={(val: string | null) => setFieldValue('status', val)}
                    mb="md"
                    disabled={status === 'loading' || status === 'saving'}
                />
                <Group>
                    <Button type="submit" loading={status === 'saving'} disabled={status === 'loading'}>Save</Button>
                    <Button variant="outline" onClick={onCancel} disabled={status === 'loading' || status === 'saving'}>Cancel</Button>
                </Group>
            </form>
        </Paper>
    )
}
