import React, { useState } from 'react'
import { api } from './api'
import { TextInput, Button, Text, Badge, Group, ActionIcon, Modal, Checkbox, Stack, Card, SimpleGrid, Center } from '@mantine/core'
import { ManagerHeader, ManagerGrid, ManagerAddCard, ManagerItemCard } from './components/ManagerUI'
import { useI18n } from './i18nContext'

export function BackendsManager({ backends, models, onRefresh }: { backends: any[], models: any[], onRefresh: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [engine, setEngine] = useState<string | null>('sqlite')
  const [filePath, setFilePath] = useState('../app/data.sqlite')
  const [pgHost, setPgHost] = useState('localhost')
  const [pgPort, setPgPort] = useState('5432')
  const [pgUser, setPgUser] = useState('postgres')
  const [pgPassword, setPgPassword] = useState('')
  const [pgDatabase, setPgDatabase] = useState('')
  const [fsProjectId, setFsProjectId] = useState('')
  const [fsCredentials, setFsCredentials] = useState('')
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
    if (!name || !engine) return
    try {
      const payload: any = { name, engine, isDefault }
      if (engine === 'sqlite') {
        payload.filePath = filePath
      } else if (engine === 'postgres') {
        payload.host = pgHost
        payload.port = parseInt(pgPort, 10)
        payload.username = pgUser
        payload.password = pgPassword
        payload.database = pgDatabase
      } else if (engine === 'firestore') {
        payload.projectId = fsProjectId
        payload.credentials = fsCredentials
      }

      await api.createBackend(payload)
      setName('')
      setEngine('sqlite')
      setFilePath('../app/data.sqlite')
      setPgHost('localhost')
      setPgPort('5432')
      setPgUser('postgres')
      setPgPassword('')
      setPgDatabase('')
      setFsProjectId('')
      setFsCredentials('')
      setIsDefault(false)
      setIsAddModalOpen(false)
      onRefresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <ManagerHeader title={t('backends.title')} description={t('backends.desc')} />

      {error && (
        <div style={{ padding: '15px', backgroundColor: 'rgba(255, 0, 0, 0.1)', color: '#ff6b6b', border: '1px solid #ff6b6b', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>{t('backends.error')}</strong> {error}</span>
          <ActionIcon variant="subtle" color="red" onClick={() => setError(null)}>✖</ActionIcon>
        </div>
      )}

      <ManagerGrid>
        <ManagerAddCard 
          label={t('backends.addBackend')}
          color="teal"
          onClick={() => setIsAddModalOpen(true)}
        />

        {/* EXISTING BACKENDS */}
        {backends.map(b => (
          <ManagerItemCard
            key={b.uid}
            title={b.name}
            onDelete={() => handleDelete(b.uid)}
            deleteLabel={t('backends.delete')}
          >
            <Group mt="md" mb="xs">
              <Badge color="teal" variant="light">{b.engine}</Badge>
              {b.isDefault && <Badge color="yellow" variant="outline">{t('backends.default')}</Badge>}
            </Group>

            <Text size="sm" c="dimmed" style={{ flex: 1, fontFamily: 'monospace' }}>
              {b.engine === 'sqlite' && b.filePath}
              {b.engine === 'postgres' && `${b.username}@${b.host}:${b.port}/${b.database}`}
              {b.engine === 'firestore' && `Project: ${b.projectId}`}
            </Text>

            <Card.Section withBorder inheritPadding py="sm" mt="md" style={{ backgroundColor: 'var(--mantine-color-default-hover)' }}>
              <Text size="sm" fw={600} mb="xs">{t('backends.deployedModels')}</Text>
              {deployments[b.uid] && deployments[b.uid].length > 0 ? (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {deployments[b.uid].map((dep: any) => {
                    const modelName = models.find(m => m.uid === dep.studioModel)?.name || dep.studioModel
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
          </ManagerItemCard>
        ))}
      </ManagerGrid>

      <Modal opened={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={t('backends.addBackend')}>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <TextInput 
            label={t('backends.name')}
            placeholder="ex: Production Locale" 
            value={name} 
            onChange={(e) => setName(e.currentTarget.value)} 
            required 
          />
          <Text fw={500} size="sm">{t('backends.engine') || 'Moteur de base de données'}</Text>
          <SimpleGrid cols={3} spacing="sm">
            {['sqlite', 'postgres', 'firestore'].map(eng => (
              <Card 
                key={eng} 
                withBorder 
                radius={0}
                shadow={engine === eng ? 'sm' : 'none'}
                style={{ 
                  cursor: 'pointer', 
                  borderColor: engine === eng ? 'var(--mantine-color-teal-filled)' : 'var(--mantine-color-default-border)',
                  backgroundColor: engine === eng ? 'var(--mantine-color-teal-light)' : 'transparent'
                }}
                onClick={() => setEngine(eng)}
                p="sm"
              >
                <Center style={{ flexDirection: 'column' }}>
                  <Text fw={600} size="sm">{eng.toUpperCase()}</Text>
                </Center>
              </Card>
            ))}
          </SimpleGrid>

          {engine === 'sqlite' && (
            <TextInput 
              label={t('backends.sqlitePath') || 'Chemin du fichier SQLite'}
              placeholder="ex: ../app/data.sqlite" 
              value={filePath} 
              onChange={(e) => setFilePath(e.currentTarget.value)} 
              required 
            />
          )}

          {engine === 'postgres' && (
            <Stack gap="sm">
              <Group grow>
                <TextInput label={t('backends.host')} required value={pgHost} onChange={e => setPgHost(e.currentTarget.value)} />
                <TextInput label={t('backends.port')} required type="number" value={pgPort} onChange={e => setPgPort(e.currentTarget.value)} />
              </Group>
              <Group grow>
                <TextInput label={t('backends.username')} required value={pgUser} onChange={e => setPgUser(e.currentTarget.value)} />
                <TextInput label={t('backends.password')} type="password" value={pgPassword} onChange={e => setPgPassword(e.currentTarget.value)} />
              </Group>
              <TextInput label={t('backends.database')} required value={pgDatabase} onChange={e => setPgDatabase(e.currentTarget.value)} />
            </Stack>
          )}

          {engine === 'firestore' && (
            <Stack gap="sm">
              <TextInput label={t('backends.projectId')} required value={fsProjectId} onChange={e => setFsProjectId(e.currentTarget.value)} />
              <TextInput label={t('backends.credentials')} required value={fsCredentials} onChange={e => setFsCredentials(e.currentTarget.value)} />
            </Stack>
          )}
          <Checkbox 
            label={t('backends.setDefault')}
            checked={isDefault} 
            onChange={(e) => setIsDefault(e.currentTarget.checked)} 
            color="teal"
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={() => setIsAddModalOpen(false)}>{t('backends.cancel')}</Button>
            <Button type="submit" variant="gradient" gradient={{ from: 'teal', to: 'green', deg: 90 }} disabled={!engine}>{t('backends.add')}</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
