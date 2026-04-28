import React, { useState, useEffect } from 'react'
import { Card, Text, Group, SimpleGrid, Title, Center, ThemeIcon, Modal, TextInput, Button, Checkbox, Stack, Image, ActionIcon, Badge } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { api } from './api'

export function StoragesManager() {
  const { t } = useTranslation()
  const [storages, setStorages] = useState<any[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(false)
  
  // Dynamic fields state
  const [s3Bucket, setS3Bucket] = useState('')
  const [s3Region, setS3Region] = useState('')
  const [localPath, setLocalPath] = useState('/data/storage')

  useEffect(() => {
    loadStorages()
  }, [])

  const loadStorages = async () => {
    const data = await api.getStorages()
    setStorages(data)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !provider) return

    const options: any = {}
    if (provider === 's3') {
      options.bucket = s3Bucket
      options.region = s3Region
    } else if (provider === 'local') {
      options.path = localPath
    }

    try {
      await api.createStorage({
        name,
        provider,
        options,
        isDefault
      })
      await loadStorages()
      setIsAddModalOpen(false)
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
                <ActionIcon variant="light" color="red" onClick={() => handleDelete(s.uid)} title="Supprimer">
                  ✖
                </ActionIcon>
              </Group>
            </Card.Section>
            
            <Stack gap="xs" mt="md" style={{ flex: 1 }}>
              <Badge color={s.provider === 's3' ? 'orange' : s.provider === 'gcs' ? 'blue' : 'gray'} variant="light" style={{ alignSelf: 'flex-start' }}>
                {s.provider.toUpperCase()}
              </Badge>
              <Text size="sm" c="dimmed" lineClamp={3}>
                {s.provider === 'local' && `Path: ${s.options?.path || ''}`}
                {s.provider === 's3' && `Bucket: ${s.options?.bucket || ''}`}
              </Text>
            </Stack>
            {s.isDefault && (
              <Badge color="green" mt="md" fullWidth>Adaptateur par défaut</Badge>
            )}
          </Card>
        ))}
      </SimpleGrid>

      <Modal opened={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={t('storages.addStorage')}>
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
            <Button variant="subtle" color="gray" onClick={() => setIsAddModalOpen(false)}>{t('storages.cancel')}</Button>
            <Button type="submit" variant="gradient" gradient={{ from: 'blue', to: 'grape', deg: 90 }} disabled={!provider}>{t('storages.add')}</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
