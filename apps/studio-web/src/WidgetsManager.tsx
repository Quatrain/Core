import { useState } from 'react'
import { Card, Text, Badge, Group, SimpleGrid, Title, Center, ThemeIcon, ActionIcon, Modal, TextInput, Select, Button, Stack } from '@mantine/core'
import { api } from './api'

export function WidgetsManager({ widgets, models, onNavigateToWidget }: { widgets: any[], models: any[], onNavigateToWidget: (uid: string) => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [widgetName, setWidgetName] = useState('')
  const [widgetType, setWidgetType] = useState('form')
  const [studioModel, setStudioModel] = useState<string | null>(null)

  const handleCreate = async () => {
     try {
        const res = await api.createWidget(widgetName, widgetType, studioModel || undefined)
        setIsModalOpen(false)
        onNavigateToWidget(res.uid)
     } catch (e) {
        console.error(e)
     }
  }

  return (
    <div style={{ padding: '20px' }}>
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={2} mb="xs">Gestion des Widgets</Title>
          <Text c="dimmed">Concevez vos formulaires, listes et interfaces.</Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="lg">
        {/* BIG ADD WIDGET CARD */}
        <Card 
          shadow="sm" 
          padding="lg" 
          radius={0} 
          withBorder
          onClick={() => {
             setWidgetName('')
             setWidgetType('form')
             setStudioModel(null)
             setIsModalOpen(true)
          }}
          style={{ 
            cursor: 'pointer', 
            transition: 'transform 0.2s ease, box-shadow 0.2s ease', 
            minHeight: '200px',
            backgroundColor: 'var(--mantine-color-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderStyle: 'dashed',
            borderWidth: '2px',
            borderColor: 'var(--mantine-color-dimmed)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = 'var(--mantine-shadow-md)'
            e.currentTarget.style.borderColor = 'var(--mantine-color-blue-filled)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)'
            e.currentTarget.style.borderColor = 'var(--mantine-color-dimmed)'
          }}
        >
          <Center style={{ flexDirection: 'column', gap: '15px' }}>
            <ThemeIcon size={60} radius="xl" variant="light" color="blue">
              <span style={{ fontSize: '30px' }}>+</span>
            </ThemeIcon>
            <Text fw={600} size="lg">Créer un Widget</Text>
          </Center>
        </Card>

        {/* EXISTING WIDGETS */}
        {widgets.map(w => (
          <Card 
            key={w.uid} 
            shadow="sm" 
            padding="lg" 
            radius={0} 
            withBorder
            style={{ 
              transition: 'transform 0.2s ease', 
              display: 'flex', 
              flexDirection: 'column',
              minHeight: '200px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Card.Section withBorder inheritPadding py="xs">
              <Group justify="space-between">
                <a href={`#/widgets/${w.uid}`} style={{textDecoration: 'none'}}>
                  <Text fw={700} size="lg" className="hover:underline">{w.name}</Text>
                </a>
                <ActionIcon component="a" href={`#/widgets/${w.uid}`} variant="light" color="blue" aria-label="Edit">
                  ✎
                </ActionIcon>
              </Group>
            </Card.Section>

            <Group mt="md" mb="xs">
              <Badge color="blue" variant="light">
                {w.widgetType}
              </Badge>
              {w.studioModel && (
                 <Badge color="gray" variant="outline">
                   Lié à: {models.find(m => m.uid === w.studioModel)?.name || 'Modèle inconnu'}
                 </Badge>
              )}
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Modal opened={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nouveau Widget">
         <Stack gap="md">
            <TextInput label="Nom du Widget" placeholder="Ex: Formulaire Administrateur" value={widgetName} onChange={e => setWidgetName(e.currentTarget.value)} required />
            
            <div>
               <Text size="sm" fw={500} mb="xs">Type de Widget</Text>
               <SimpleGrid cols={2} spacing="sm">
                  {[
                     { type: 'form', icon: '📝', label: 'Formulaire', desc: 'Saisie et édition' },
                     { type: 'list', icon: '📋', label: 'Tableau', desc: 'Affichage en liste' },
                     { type: 'map', icon: '🗺️', label: 'Carte', desc: 'Géolocalisation' },
                     { type: 'graph', icon: '📊', label: 'Graphique', desc: 'Visualisation' }
                  ].map(t => (
                     <Card 
                        key={t.type} 
                        withBorder 
                        p="sm" 
                        style={{ 
                           cursor: 'pointer', 
                           borderColor: widgetType === t.type ? 'var(--mantine-color-blue-filled)' : undefined,
                           backgroundColor: widgetType === t.type ? 'var(--mantine-color-blue-light)' : undefined
                        }}
                        onClick={() => setWidgetType(t.type)}
                     >
                        <Group wrap="nowrap">
                           <Text size="xl">{t.icon}</Text>
                           <div>
                              <Text size="sm" fw={600}>{t.label}</Text>
                              <Text size="xs" c="dimmed" lh={1.1}>{t.desc}</Text>
                           </div>
                        </Group>
                     </Card>
                  ))}
               </SimpleGrid>
            </div>
            <Select 
               label="Modèle cible (Optionnel)" 
               description="Permet de pré-remplir la boîte à outils avec les champs du modèle."
               placeholder="Aucun"
               clearable
               data={models.map(m => ({ value: m.uid, label: m.name }))}
               value={studioModel}
               onChange={setStudioModel}
            />
            <Button onClick={handleCreate} color="blue" fullWidth mt="md">Créer le Widget</Button>
         </Stack>
      </Modal>
    </div>
  )
}
