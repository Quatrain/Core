import React, { useState, useEffect } from 'react'
import { Card, Text, Group, SimpleGrid, Title, Center, ThemeIcon, Modal, TextInput, Button, Checkbox, Stack, ActionIcon, Badge, Select } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { api } from './api'

export function StoragesManager() {
  const { t } = useTranslation()
  const [storages, setStorages] = useState<any[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingStorageId, setEditingStorageId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(false)
  
  // Dynamic fields state
  const [s3Bucket, setS3Bucket] = useState('')
  const [s3Region, setS3Region] = useState('')
  const [s3Endpoint, setS3Endpoint] = useState('')
  const [s3SecretId, setS3SecretId] = useState<string | null>(null)
  const [localPath, setLocalPath] = useState('/data/storage')
  
  const [secrets, setSecrets] = useState<any[]>([])
  const [environments, setEnvironments] = useState<any[]>([])

  useEffect(() => {
    loadStorages()
  }, [])

  const loadStorages = async () => {
    try {
      const [data, secs, envs] = await Promise.all([
        api.getStorages(),
        api.getSecrets(),
        api.getProjects().then(projs => projs.length > 0 ? api.getEnvironments(projs[0].uid) : [])
      ])
      setStorages(data)
      setSecrets(secs)
      setEnvironments(envs)
    } catch (e) {
      console.error(e)
    }
  }

  const handleEdit = (storage: any) => {
    setEditingStorageId(storage.uid)
    setName(storage.name)
    setProvider(storage.provider)
    setIsDefault(storage.isDefault || false)

    // Reset fields
    setS3Bucket('')
    setS3Region('')
    setS3Endpoint('')
    setS3SecretId(null)
    setLocalPath('/data/storage')

    if (storage.provider === 's3' && storage.options) {
      setS3Bucket(storage.options.bucket || '')
      setS3Region(storage.options.region || '')
      setS3Endpoint(storage.options.endpoint || '')
      setS3SecretId(storage.options.secretId || null)
    } else if (storage.provider === 'local' && storage.options) {
      setLocalPath(storage.options.path || '/data/storage')
    }

    setIsAddModalOpen(true)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !provider) return

    const options: any = {}
    if (provider === 's3') {
      options.bucket = s3Bucket
      options.region = s3Region
      if (s3Endpoint) options.endpoint = s3Endpoint
      if (s3SecretId) options.secretId = s3SecretId
    } else if (provider === 'local') {
      options.path = localPath
    }

    try {
      if (editingStorageId) {
        await api.updateStorage(editingStorageId, {
          name,
          provider,
          options,
          isDefault
        })
      } else {
        await api.createStorage({
          name,
          provider,
          options,
          isDefault
        })
      }
      await loadStorages()
      setIsAddModalOpen(false)
      setEditingStorageId(null)
      setName('')
      setProvider(null)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('app.confirmDelete', 'Êtes-vous sûr de vouloir supprimer cet élément ?'))) return
    try {
      await api.deleteStorage(id)
      await loadStorages()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={2} mb="xs">{t('storages.title')}</Title>
          <Text c="dimmed">{t('storages.desc')}</Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {/* BIG ADD STORAGE CARD */}
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
            e.currentTarget.style.borderColor = 'var(--mantine-color-blue-filled)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)'
            e.currentTarget.style.borderColor = 'var(--mantine-color-dimmed)'
          }}
        >
          <Stack align="center" gap="xs">
            <ThemeIcon size={60} radius="xl" variant="light" color="blue">
              <span style={{ fontSize: '30px' }}>+</span>
            </ThemeIcon>
            <Text fw={600} size="lg" mt="md" c="dimmed">
              {t('storages.addStorage')}
            </Text>
          </Stack>
        </Card>

        {storages.map(s => (
          <Card 
            key={s.uid} 
            shadow="sm" 
            padding="lg" 
            radius={0} 
            withBorder
            style={{ 
              transition: 'transform 0.2s ease', 
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Card.Section withBorder inheritPadding py="xs">
              <Group justify="space-between">
                <Text fw={700} size="lg">{s.name}</Text>
                <Group gap="xs">
                  <ActionIcon variant="light" color="blue" onClick={() => handleEdit(s)} title="Modifier">
                    ✏️
                  </ActionIcon>
                  <ActionIcon variant="light" color="red" onClick={() => handleDelete(s.uid)} title="Supprimer">
                    ✖
                  </ActionIcon>
                </Group>
              </Group>
            </Card.Section>
            
            <Stack gap="xs" mt="md" style={{ flex: 1 }}>
              <Badge color={s.provider === 's3' ? 'orange' : s.provider === 'gcs' ? 'blue' : 'gray'} variant="light" style={{ alignSelf: 'flex-start' }}>
                {s.provider.toUpperCase()}
              </Badge>
              <Text size="sm" c="dimmed" lineClamp={3}>
                {s.provider === 'local' && `Path: ${s.options?.path || ''}`}
                {s.provider === 's3' && `Bucket: ${s.options?.bucket || ''}${s.options?.endpoint ? ` • ${s.options.endpoint}` : ''}`}
              </Text>
            </Stack>
            {s.isDefault && (
              <Badge color="green" mt="md" fullWidth>Adaptateur par défaut</Badge>
            )}
          </Card>
        ))}
      </SimpleGrid>

      <Modal opened={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setEditingStorageId(null); setName(''); setProvider(null); }} title={editingStorageId ? 'Modifier le stockage' : t('storages.addStorage')}>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <TextInput 
            label={t('storages.name')}
            placeholder="ex: Assets S3" 
            value={name} 
            onChange={(e) => setName(e.currentTarget.value)} 
            required 
          />
          <Text fw={500} size="sm">{t('storages.provider')}</Text>
          <SimpleGrid cols={3} spacing="sm">
            {['s3', 'local', 'gcs'].map(p => (
              <Card 
                key={p} 
                withBorder 
                radius={0}
                shadow={provider === p ? 'sm' : 'none'}
                style={{ 
                  cursor: 'pointer', 
                  borderColor: provider === p ? 'var(--mantine-color-blue-filled)' : 'var(--mantine-color-default-border)',
                  backgroundColor: provider === p ? 'var(--mantine-color-blue-light)' : 'transparent'
                }}
                onClick={() => setProvider(p)}
                p="sm"
              >
                <Center style={{ flexDirection: 'column' }}>
                  <Text fw={600} size="sm">{p.toUpperCase()}</Text>
                </Center>
              </Card>
            ))}
          </SimpleGrid>

          {provider === 's3' && (
            <Stack gap="sm">
              <TextInput label="Bucket" required value={s3Bucket} onChange={e => setS3Bucket(e.currentTarget.value)} />
              <TextInput label="Region" required value={s3Region} onChange={e => setS3Region(e.currentTarget.value)} />
              <TextInput label="Endpoint (Optionnel)" placeholder="ex: https://s3.fr-par.scw.cloud" value={s3Endpoint} onChange={e => setS3Endpoint(e.currentTarget.value)} />
              <Select 
                label="Trousseau de secrets (Optionnel)" 
                placeholder="Sélectionner un trousseau contenant les credentials"
                data={secrets.map(s => {
                  const env = environments.find(e => e.uid === s.environmentId)
                  return { value: s.uid, label: `${s.name} ${env ? `(${env.name})` : ''}` }
                })}
                value={s3SecretId}
                onChange={setS3SecretId}
                clearable
              />
            </Stack>
          )}

          {provider === 'local' && (
            <TextInput label="Base Path" required value={localPath} onChange={e => setLocalPath(e.currentTarget.value)} />
          )}

          {provider === 'gcs' && (
            <TextInput label="Bucket" required />
          )}

          <Checkbox 
            label={t('storages.setDefault') || 'Définir comme stockage par défaut'}
            checked={isDefault}
            onChange={(e) => setIsDefault(e.currentTarget.checked)}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={() => { setIsAddModalOpen(false); setEditingStorageId(null); setName(''); setProvider(null); }}>{t('storages.cancel')}</Button>
            <Button type="submit" variant="gradient" gradient={{ from: 'blue', to: 'grape', deg: 90 }} disabled={!provider}>{editingStorageId ? 'Sauvegarder' : t('storages.add')}</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
