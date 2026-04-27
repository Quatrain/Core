import React, { useEffect, useState } from 'react'
import { Card, Text, Badge, Group, SimpleGrid, Title, UnstyledButton, Center, ThemeIcon, ActionIcon } from '@mantine/core'
import { api } from './api'
import { useTranslation } from 'react-i18next'

export function Dashboard({ models, backends, onNavigateToNewModel }: { models: any[], backends: any[], onNavigateToNewModel: () => void }) {
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
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={2} mb="xs">{t('app.dashboard')}</Title>
          <Text c="dimmed">
            {t('dashboard.activeBackend')} {backends.length > 0 ? <Text component="span" fw={600} c="blue">{backends[0].name}</Text> : 'None'}
          </Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="lg">
        {/* BIG ADD MODEL CARD */}
        <Card 
          shadow="sm" 
          padding="lg" 
          radius="md" 
          withBorder
          onClick={onNavigateToNewModel}
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
            <Text fw={600} size="lg">{t('dashboard.addModel')}</Text>
          </Center>
        </Card>

        {/* EXISTING MODELS */}
        {models.map(m => (
          <Card 
            key={m.uid} 
            shadow="sm" 
            padding="lg" 
            radius="md" 
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
                <a href={`#/models/${m.name}`} style={{textDecoration: 'none'}}>
                  <Text fw={700} size="lg" className="hover:underline">{m.name}</Text>
                </a>
                <ActionIcon component="a" href={`#/models/${m.name}`} variant="light" color="blue" aria-label="Edit">
                  ✎
                </ActionIcon>
              </Group>
            </Card.Section>

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
          </Card>
        ))}
      </SimpleGrid>
    </div>
  )
}
