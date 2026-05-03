import { useState, useEffect } from 'react'
import { Card, Text, Title, Group, Button, Stack, ActionIcon, Badge, Paper, SimpleGrid, Accordion } from '@mantine/core'

export function WidgetBuilder({ widget, properties, projectDefaultLanguage, onSave }: { widget: any, model?: any, properties: any[], projectLanguages?: string[], projectDefaultLanguage?: string, onSave: (data: any) => Promise<any> }) {
  
  // Builder state
  const [layout, setLayout] = useState<any[]>(widget.layout || [])
  
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null)
  const [dragOverItemIdx, setDragOverItemIdx] = useState<number | null>(null)

  const defaultLang = projectDefaultLanguage || 'en'

  const getFieldLabel = (p: any) => {
     if (p.ui && p.ui.labels && p.ui.labels[defaultLang] && p.ui.labels[defaultLang].trim() !== '') {
        return p.ui.labels[defaultLang]
     }
     
     // Auto translation for system fields
     const sysLabels: any = {
        'fr': {
           'uid': 'Identifiant unique',
           'status': 'Statut',
           'createdAt': 'Créé le',
           'createdBy': 'Créé par',
           'updatedAt': 'Mis à jour le',
           'updatedBy': 'Mis à jour par'
        },
        'en': {
           'uid': 'Unique Identifier',
           'status': 'Status',
           'createdAt': 'Created at',
           'createdBy': 'Created by',
           'updatedAt': 'Updated at',
           'updatedBy': 'Updated by'
        }
     }
     
     if (sysLabels[defaultLang] && sysLabels[defaultLang][p.name]) {
         return sysLabels[defaultLang][p.name]
     }
     
     return p.name
  }

  useEffect(() => {
    if (widget) {
       setLayout(widget.layout || [])
    }
  }, [widget])

  const handleSaveWidget = async () => {
     try {
        await onSave({ layout })
        alert("Widget sauvegardé !")
     } catch (e) {
        console.error(e)
     }
  }

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
      {/* Main Area: Builder */}
      <Paper shadow="sm" p="md" withBorder style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Group justify="space-between" mb="lg">
          <Title order={3}>{widget.name} ({widget.widgetType})</Title>
          <Button color="green" onClick={handleSaveWidget}>Sauvegarder le layout</Button>
        </Group>

        <div style={{ display: 'flex', gap: '20px', flex: 1 }}>
             <div style={{ width: '250px', borderRight: '1px solid var(--mantine-color-default-border)', paddingRight: '20px' }}>
                <Title order={5} mb="md">Champs disponibles</Title>
                <div style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '10px', fontSize: '12px' }}>
                   DEBUG: widget.studioModel={widget.studioModel || 'NONE'}, props.length={properties.length}
                </div>
                <Stack gap="xs">
                   {[...properties].sort((a, b) => {
                      if (a.name === 'name') return -1
                      if (b.name === 'name') return 1
                      return (a.order || 0) - (b.order || 0)
                   }).map(p => (
                      <Card key={p.uid} p="xs" withBorder shadow="sm" style={{ cursor: 'grab' }} draggable onDragStart={(e) => {
                         e.dataTransfer.setData('text/plain', JSON.stringify({ name: p.name, label: getFieldLabel(p) }))
                      }}>
                         <Text size="sm" fw={500}>{getFieldLabel(p)}</Text>
                      </Card>
                   ))}
                </Stack>

                <Accordion variant="contained" mt="md">
                   <Accordion.Item value="system">
                      <Accordion.Control><Text size="sm" fw={600}>Métadonnées système</Text></Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                           {[
                              { uid: 'sys-uid', name: 'uid' },
                              { uid: 'sys-status', name: 'status' },
                              { uid: 'sys-createdAt', name: 'createdAt' },
                              { uid: 'sys-createdBy', name: 'createdBy' },
                              { uid: 'sys-updatedAt', name: 'updatedAt' },
                              { uid: 'sys-updatedBy', name: 'updatedBy' }
                           ].map(p => (
                              <Card key={p.uid} p="xs" withBorder shadow="sm" style={{ cursor: 'grab' }} draggable onDragStart={(e) => {
                                 e.dataTransfer.setData('text/plain', JSON.stringify({ name: p.name, label: getFieldLabel(p) }))
                              }}>
                                 <Text size="sm" fw={500}>{getFieldLabel(p)}</Text>
                              </Card>
                           ))}
                        </Stack>
                      </Accordion.Panel>
                   </Accordion.Item>
                </Accordion>
             </div>

             {/* Canvas */}
             <div style={{ flex: 1, backgroundColor: 'var(--mantine-color-default-hover)', padding: '20px', borderRadius: '8px' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                   e.preventDefault()
                   if (draggedItemIdx !== null) {
                      const newLayout = [...layout]
                      const [moved] = newLayout.splice(draggedItemIdx, 1)
                      newLayout.push(moved)
                      setLayout(newLayout)
                      setDraggedItemIdx(null)
                   } else {
                      const rawData = e.dataTransfer.getData('text/plain')
                      if (rawData && rawData !== 'reorder') {
                         try {
                            const data = JSON.parse(rawData)
                            setLayout([...layout, { type: 'field', name: data.name, label: data.label }])
                         } catch(err) {
                            setLayout([...layout, { type: 'field', name: rawData, label: rawData }])
                         }
                      }
                   }
                }}
             >
                <Title order={5} mb="md">Canevas (Glissez les champs ici)</Title>
                {layout.length === 0 && <Text c="dimmed">Le widget est vide. Glissez des champs depuis la liste.</Text>}
                
                <Stack gap="md">
                   {layout.map((item, idx) => (
                      <Card 
                         key={idx} 
                         withBorder 
                         shadow="sm" 
                         p="md"
                         draggable
                         onDragStart={(e) => {
                            setDraggedItemIdx(idx)
                            e.dataTransfer.setData('text/plain', 'reorder')
                         }}
                         onDragOver={(e) => {
                            e.preventDefault()
                            setDragOverItemIdx(idx)
                         }}
                         onDragLeave={() => setDragOverItemIdx(null)}
                         onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDragOverItemIdx(null)
                            if (draggedItemIdx !== null && draggedItemIdx !== idx) {
                               const newLayout = [...layout]
                               const [moved] = newLayout.splice(draggedItemIdx, 1)
                               newLayout.splice(idx, 0, moved)
                               setLayout(newLayout)
                            } else {
                               const rawData = e.dataTransfer.getData('text/plain')
                               if (rawData && rawData !== 'reorder') {
                                  try {
                                     const data = JSON.parse(rawData)
                                     const newLayout = [...layout]
                                     newLayout.splice(idx, 0, { type: 'field', name: data.name, label: data.label })
                                     setLayout(newLayout)
                                  } catch(err) {
                                     const newLayout = [...layout]
                                     newLayout.splice(idx, 0, { type: 'field', name: rawData, label: rawData })
                                     setLayout(newLayout)
                                  }
                               }
                            }
                            setDraggedItemIdx(null)
                         }}
                         style={{
                            cursor: 'grab',
                            opacity: draggedItemIdx === idx ? 0.5 : 1,
                            borderTop: dragOverItemIdx === idx ? '2px solid var(--mantine-color-teal-filled)' : undefined
                         }}
                      >
                         <Group justify="space-between">
                            <Text fw={700}>{item.type === 'group' ? 'Groupe' : (item.label || item.name)}</Text>
                            <ActionIcon color="red" variant="light" onClick={() => {
                               const nl = [...layout]
                               nl.splice(idx, 1)
                               setLayout(nl)
                            }}>✖</ActionIcon>
                         </Group>
                         {item.type === 'group' && (
                            <SimpleGrid cols={2} mt="sm">
                               {item.fields.map((f: string) => <Badge key={f}>{f}</Badge>)}
                            </SimpleGrid>
                         )}
                      </Card>
                   ))}
                </Stack>
             </div>
          </div>
        </Paper>
    </div>
  )
}
