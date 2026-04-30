import React, { useEffect, useState } from 'react'
import { TextInput, NumberInput, Checkbox, Button, Group, Title, Paper, Select } from '@mantine/core'

export interface QuatrainFormProps {
    modelSchema: any
    objectId: string | undefined
    apiClient: any
    onSave: () => void
    onCancel: () => void
}

export function QuatrainForm({ modelSchema, objectId, apiClient, onSave, onCancel }: QuatrainFormProps) {
    const [formData, setFormData] = useState<any>({ status: 'created' })
    const [relationOptions, setRelationOptions] = useState<Record<string, {label: string, value: string}[]>>({})

    const m = modelSchema.name
    const props = modelSchema.properties || []
    const ignoredProps = ['id', 'status', 'createdat', 'updatedat', 'deletedat', 'createdby', 'updatedby', 'deletedby']

    useEffect(() => {
        if (objectId && objectId !== 'new') {
            apiClient.get(`${m.toLowerCase()}s/` + objectId).then((res: any) => {
                if (res && res.data) {
                    setFormData(res.data)
                }
            })
        }
    }, [objectId, m, apiClient])

    useEffect(() => {
        // Fetch values for all relation properties
        for (const p of props) {
            if (p.options?.instanceOf) {
                const targetModel = typeof p.options.instanceOf === 'string' ? p.options.instanceOf : p.type
                let url = `${targetModel.toLowerCase()}s/values`
                apiClient.get(url).then((res: any) => {
                    if (res && res.data) {
                        const pattern = p.options?.pattern
                        const formattedData = res.data.map((item: any) => {
                            let label = item.name || item.value
                            if (pattern) {
                                label = pattern.replace(/\\$\\{([^}]+)\\}/g, (match: string, prop: string) => {
                                    return item[prop] !== undefined ? String(item[prop]) : match
                                })
                            }
                            return { label, value: item.value }
                        })
                        setRelationOptions(prev => ({ ...prev, [p.name]: formattedData }))
                    }
                }).catch((e: any) => console.error('Failed to load relation values', e))
            }
        }
    }, [props, apiClient])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (objectId === 'new') {
            await apiClient.post(`${m.toLowerCase()}s`, formData)
        } else {
            await apiClient.patch(`${m.toLowerCase()}s/` + objectId, formData)
        }
        onSave()
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
                    onChange={e => setFormData({...formData, [propName]: e.target.value})} 
                    mb="sm" 
                />
            )
        } else if (p.type === 'NumberProperty') {
            return (
                <NumberInput 
                    key={propName}
                    label={propName} 
                    value={formData[propName] || 0} 
                    onChange={val => setFormData({...formData, [propName]: val})} 
                    mb="sm" 
                />
            )
        } else if (p.type === 'BooleanProperty') {
            return (
                <Checkbox 
                    key={propName}
                    label={propName} 
                    checked={formData[propName] || false} 
                    onChange={e => setFormData({...formData, [propName]: e.currentTarget.checked})} 
                    mb="sm" 
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
                    onChange={val => setFormData({...formData, [propName]: val})} 
                    mb="sm" 
                />
            )
        } else if (p.type === 'DateTimeProperty') {
            return (
                <TextInput 
                    key={propName}
                    type="datetime-local"
                    label={propName} 
                    value={formData[propName] || ''} 
                    onChange={e => setFormData({...formData, [propName]: e.target.value})} 
                    mb="sm" 
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
                    onChange={val => setFormData({...formData, [propName]: val})}
                    searchable
                    clearable
                    mb="sm"
                />
            )
        } else {
            return (
                <TextInput 
                    key={propName}
                    label={propName + ' (' + p.type + ')'} 
                    value={formData[propName] || ''} 
                    onChange={e => setFormData({...formData, [propName]: e.target.value})} 
                    mb="sm" 
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
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    mb="sm" 
                />
                
                {props.map((p: any) => renderField(p))}

                <Select
                    label="Status"
                    data={['created', 'pending', 'active', 'deleted']}
                    value={formData.status || 'created'}
                    onChange={val => setFormData({...formData, status: val})}
                    mb="md"
                />
                <Group>
                    <Button type="submit">Save</Button>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                </Group>
            </form>
        </Paper>
    )
}
