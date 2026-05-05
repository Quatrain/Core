import { useState } from 'react'
import { Card, Text, Badge, Group, Modal, TextInput, Select, Button, Stack, SimpleGrid } from '@mantine/core'
import { ManagerHeader, ManagerGrid, ManagerAddCard, ManagerItemCard } from './components/ManagerUI'
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
      <ManagerHeader title="Gestion des Widgets" description="Concevez vos formulaires, listes et interfaces." />

      <ManagerGrid>
        <ManagerAddCard 
          label="Créer un Widget"
          color="blue"
          onClick={() => {
             setWidgetName('')
             setWidgetType('form')
             setStudioModel(null)
             setIsModalOpen(true)
          }}
        />

        {/* EXISTING WIDGETS */}
        {widgets.map(w => (
          <ManagerItemCard
            key={w.uid}
            title={
              <a href={`#/widgets/${w.uid}`} style={{textDecoration: 'none'}}>
                <Text fw={700} size="lg" className="hover:underline">{w.name}</Text>
              </a>
            }
            onEdit={() => window.location.href = `#/widgets/${w.uid}`}
          >
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
          </ManagerItemCard>
        ))}
      </ManagerGrid>

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
