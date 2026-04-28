import React, { useState } from 'react'
import { api } from './api'
import { TextInput, Button, Card, Text, Badge, Group, SimpleGrid, Title, Center, ThemeIcon, ActionIcon, Modal, Checkbox } from '@mantine/core'
import { useTranslation } from 'react-i18next'

export function BackendsManager({ backends, models, onRefresh }: { backends: any[], models: any[], onRefresh: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [filePath, setFilePath] = useState('../app/data.sqlite')
  const [isDefault, setIsDefault] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deployments, setDeployments] = useState<Record<string, any[]>>({})
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  React.useEffect(() => {
    // Load deployments for each backend
    const loadDeployments = async () => {
      const deps: Record<string, any[]> = {}
      for (const b of backends) {
        try {
          deps[b.uid] = await api.getDeployments(b.uid)
        } catch (e) {
          console.error(e)
        }
      }
      setDeployments(deps)
    }
    loadDeployments()
  }, [backends])

  const handleDelete = async (id: string) => {
    if (!confirm(t('backends.deleteConfirm'))) return
    try {
      await api.deleteBackend(id)
      onRefresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createBackend({
        name,
        engine: 'sqlite',
        filePath,
        isDefault
      })
      setName('')
      setFilePath('../app/data.sqlite')
      setIsDefault(false)
      setIsAddModalOpen(false)
      onRefresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={2} mb="xs">{t('backends.title')}</Title>
          <Text c="dimmed">{t('backends.desc')}</Text>
        </div>
      </Group>

      {error && (
        <div style={{ padding: '15px', backgroundColor: 'rgba(255, 0, 0, 0.1)', color: '#ff6b6b', border: '1px solid #ff6b6b', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>{t('backends.error')}</strong> {error}</span>
          <ActionIcon variant="subtle" color="red" onClick={() => setError(null)}>✖</ActionIcon>
        </div>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {/* BIG ADD BACKEND CARD */}
        <Card 
          shadow="sm" 
          padding="lg" 
          radius={0} 
          withBorder
          onClick={() => setIsAddModalOpen(true)}
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
            e.currentTarget.style.borderColor = 'var(--mantine-color-teal-filled)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)'
            e.currentTarget.style.borderColor = 'var(--mantine-color-dimmed)'
          }}
        >
          <Center style={{ flexDirection: 'column', gap: '15px' }}>
            <ThemeIcon size={60} radius="xl" variant="light" color="teal">
              <span style={{ fontSize: '30px' }}>+</span>
            </ThemeIcon>
            <Text fw={600} size="lg">{t('backends.addBackend')}</Text>
          </Center>
        </Card>

        {/* EXISTING BACKENDS */}
        {backends.map(b => (
          <Card 
            key={b.uid} 
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
                <Text fw={700} size="lg">{b.name}</Text>
                <ActionIcon variant="light" color="red" onClick={() => handleDelete(b.uid)} title="Supprimer">
                  ✖
                </ActionIcon>
              </Group>
            </Card.Section>

            <Group mt="md" mb="xs">
              <Badge color="teal" variant="light">{b.engine}</Badge>
              {b.isDefault && <Badge color="yellow" variant="outline">{t('backends.default')}</Badge>}
            </Group>

            <Text size="sm" c="dimmed" style={{ flex: 1, fontFamily: 'monospace' }}>
              {b.filePath}
            </Text>

            <Card.Section withBorder inheritPadding py="sm" mt="md" style={{ backgroundColor: 'var(--mantine-color-default-hover)' }}>
              <Text size="sm" fw={600} mb="xs">{t('backends.deployedModels')}</Text>
              {deployments[b.uid] && deployments[b.uid].length > 0 ? (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {deployments[b.uid].map((dep: any) => {
                    const modelName = models.find(m => m.uid === dep.modelId)?.name || dep.modelId
                    return (
                      <Badge key={dep.uid} size="sm" variant="dot" color="blue">
                        {modelName} (v{dep.version})
                      </Badge>
                    )
                  })}
                </div>
              ) : (
                <Text size="sm" c="dimmed" fs="italic">{t('backends.noDeployments')}</Text>
              )}
            </Card.Section>
          </Card>
        ))}
      </SimpleGrid>

      <Modal opened={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={t('backends.addBackend')}>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <TextInput 
            label={t('backends.name')}
            placeholder="ex: Production Locale" 
            value={name} 
            onChange={(e) => setName(e.currentTarget.value)} 
            required 
          />
          <TextInput 
            label={t('backends.sqlitePath')}
            placeholder="ex: ../app/data.sqlite" 
            value={filePath} 
            onChange={(e) => setFilePath(e.currentTarget.value)} 
            required 
          />
          <Checkbox 
            label={t('backends.setDefault')}
            checked={isDefault} 
            onChange={(e) => setIsDefault(e.currentTarget.checked)} 
            color="teal"
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={() => setIsAddModalOpen(false)}>{t('backends.cancel')}</Button>
            <Button type="submit" variant="gradient" gradient={{ from: 'teal', to: 'green', deg: 90 }}>{t('backends.add')}</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
