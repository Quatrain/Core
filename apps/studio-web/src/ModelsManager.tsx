import { useEffect, useState } from 'react'
import { Text, Badge, Group, Card } from '@mantine/core'
import { ManagerHeader, ManagerGrid, ManagerAddCard, ManagerItemCard } from './components/ManagerUI'
import { api } from './api'
import { useTranslation } from 'react-i18next'

export function ModelsManager({ models, backends, onNavigateToNewModel }: { models: any[], backends: any[], onNavigateToNewModel: () => void }) {
  const { t } = useTranslation()
  const [stats, setStats] = useState<Record<string, {count: number, status: string}>>({})

  useEffect(() => {
    // If there is at least one backend, we fetch stats
    const fetchStats = async () => {
      if (backends.length === 0) return
      const defaultBackend = backends[0]
      const newStats: any = {}
      for (const m of models) {
        try {
          const res = await api.getModelStats(m.uid, defaultBackend.uid)
          if (res.data) newStats[m.uid] = res.data
        } catch (e) {
          console.error(e)
        }
      }
      setStats(newStats)
    }
    fetchStats()
  }, [models, backends])

  return (
    <div style={{ padding: '20px' }}>
      <ManagerHeader title={t('modelsManager.title') || "Gestion des Modèles"} description={t('modelsManager.desc') || "Gérez les schémas de données de votre application."} />

      <ManagerGrid>
        <ManagerAddCard 
          label={t('dashboard.addModel')}
          color="blue"
          onClick={onNavigateToNewModel}
        />

        {/* EXISTING MODELS */}
        {models.map(m => (
          <ManagerItemCard
            key={m.uid}
            title={
              <a href={`#/models/${m.name}`} style={{textDecoration: 'none'}}>
                <Text fw={700} size="lg" className="hover:underline">{m.name}</Text>
              </a>
            }
            onEdit={() => window.location.href = `#/models/${m.name}`}
          >
            <Group mt="md" mb="xs">
              <Badge color="gray" variant="light">
                {m.collectionName || m.name.toLowerCase()}
              </Badge>
              <Badge color="grape" variant="light">
                v{m.version > 1 ? m.version - 1 : 1}
              </Badge>
            </Group>

            <Text size="sm" c="dimmed" style={{ flex: 1 }}>
              {m.version === 1 ? t('dashboard.draft') : `${t('dashboard.currentActiveVersion')} ${m.version - 1}`}
            </Text>

            <Card.Section withBorder inheritPadding py="sm" mt="md" style={{ backgroundColor: 'var(--mantine-color-default-hover)' }}>
              {stats[m.uid] ? (
                <>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', 
                        backgroundColor: stats[m.uid].status === 'deployed' ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-orange-6)'
                      }} />
                      <Text size="sm" c={stats[m.uid].status === 'deployed' ? 'teal' : 'orange'} fw={500}>
                        {stats[m.uid].status === 'deployed' ? t('dashboard.deployed') : t('dashboard.pending')}
                      </Text>
                    </Group>
                  </Group>
                  
                  {stats[m.uid].status === 'deployed' && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">{stats[m.uid].count} {t('dashboard.records')}</Text>
                      <a href={`#/data/${m.name}`} style={{fontSize: '13px', color: 'var(--mantine-color-blue-filled)', textDecoration: 'none', fontWeight: 500}}>
                        {t('dashboard.editData')} →
                      </a>
                    </Group>
                  )}
                </>
              ) : (
                <Text size="sm" c="dimmed">...</Text>
              )}
            </Card.Section>
          </ManagerItemCard>
        ))}
      </ManagerGrid>
    </div>
  )
}
