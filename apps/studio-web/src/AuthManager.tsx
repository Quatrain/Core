import React, { useState, useEffect } from 'react'
import { Card, Text, Group, SimpleGrid, Title, Center, ThemeIcon, Modal, TextInput, Button, Checkbox, Stack, ActionIcon, Badge } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { api } from './api'

export function AuthManager() {
  const { t } = useTranslation()
  const [auths, setAuths] = useState<any[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(false)

  // Dynamic fields
  const [pbUrl, setPbUrl] = useState('http://127.0.0.1:8090')
  const [sbUrl, setSbUrl] = useState('')
  const [sbAnonKey, setSbAnonKey] = useState('')
  const [fbProjectId, setFbProjectId] = useState('')
  const [fbApiKey, setFbApiKey] = useState('')

  useEffect(() => {
    loadAuths()
  }, [])

  const loadAuths = async () => {
    const data = await api.getAuths()
    setAuths(data)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !provider) return

    const options: any = {}
    if (provider === 'pocketbase') {
      options.url = pbUrl
    } else if (provider === 'supabase') {
      options.url = sbUrl
      options.anonKey = sbAnonKey
    } else if (provider === 'firebase') {
      options.projectId = fbProjectId
      options.apiKey = fbApiKey
    }

    try {
      await api.createAuth({
        name,
        provider,
        options,
        isDefault
      })
      await loadAuths()
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
      await api.deleteAuth(id)
      await loadAuths()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={2} mb="xs">{t('auth.title')}</Title>
          <Text c="dimmed">{t('auth.desc')}</Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {/* BIG ADD AUTH CARD */}
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
            e.currentTarget.style.borderColor = 'var(--mantine-color-violet-filled)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)'
            e.currentTarget.style.borderColor = 'var(--mantine-color-dimmed)'
          }}
        >
          <Stack align="center" gap="xs">
            <ThemeIcon size={60} radius="xl" variant="light" color="violet">
              <span style={{ fontSize: '30px' }}>+</span>
            </ThemeIcon>
            <Text fw={600} size="lg" mt="md" c="dimmed">
              {t('auth.add')}
            </Text>
          </Stack>
        </Card>

        {auths.map(a => (
          <Card 
            key={a.uid} 
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
                <Text fw={700} size="lg">{a.name}</Text>
                <ActionIcon variant="light" color="red" onClick={() => handleDelete(a.uid)} title="Supprimer">
                  ✖
                </ActionIcon>
              </Group>
            </Card.Section>
            
            <Stack gap="xs" mt="md" style={{ flex: 1 }}>
              <Badge color={a.provider === 'pocketbase' ? 'teal' : a.provider === 'supabase' ? 'green' : 'orange'} variant="light" style={{ alignSelf: 'flex-start' }}>
                {a.provider.toUpperCase()}
              </Badge>
              <Text size="sm" c="dimmed" lineClamp={3}>
                {a.provider === 'pocketbase' && `URL: ${a.options?.url || ''}`}
                {a.provider === 'supabase' && `URL: ${a.options?.url || ''}`}
                {a.provider === 'firebase' && `Project ID: ${a.options?.projectId || ''}`}
              </Text>
            </Stack>
            {a.isDefault && (
              <Badge color="green" mt="md" fullWidth>Adaptateur par défaut</Badge>
            )}
          </Card>
        ))}
      </SimpleGrid>

      <Modal opened={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={t('auth.addAuth')}>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <TextInput 
            label={t('auth.name')}
            placeholder="ex: Google OAuth" 
            value={name} 
            onChange={(e) => setName(e.currentTarget.value)} 
            required 
          />
          <Text fw={500} size="sm">{t('auth.type')}</Text>
          <SimpleGrid cols={3} spacing="sm">
            {['pocketbase', 'supabase', 'firebase'].map(p => (
              <Card 
                key={p} 
                withBorder 
                radius={0}
                shadow={provider === p ? 'sm' : 'none'}
                style={{ 
                  cursor: 'pointer', 
                  borderColor: provider === p ? 'var(--mantine-color-violet-filled)' : 'var(--mantine-color-default-border)',
                  backgroundColor: provider === p ? 'var(--mantine-color-violet-light)' : 'transparent'
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

          {provider === 'pocketbase' && (
            <TextInput label="PocketBase API URL" required value={pbUrl} onChange={e => setPbUrl(e.currentTarget.value)} />
          )}

          {provider === 'supabase' && (
            <Stack gap="sm">
              <TextInput label="Supabase URL" required value={sbUrl} onChange={e => setSbUrl(e.currentTarget.value)} />
              <TextInput label="Anon Key" type="password" required value={sbAnonKey} onChange={e => setSbAnonKey(e.currentTarget.value)} />
            </Stack>
          )}

          {provider === 'firebase' && (
            <Stack gap="sm">
              <TextInput label="Project ID" required value={fbProjectId} onChange={e => setFbProjectId(e.currentTarget.value)} />
              <TextInput label="API Key" type="password" required value={fbApiKey} onChange={e => setFbApiKey(e.currentTarget.value)} />
            </Stack>
          )}

          <Checkbox 
            label={t('auth.setDefault') || 'Définir comme adaptateur Auth par défaut'}
            checked={isDefault}
            onChange={(e) => setIsDefault(e.currentTarget.checked)}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={() => setIsAddModalOpen(false)}>{t('auth.cancel')}</Button>
            <Button type="submit" variant="gradient" gradient={{ from: 'violet', to: 'pink', deg: 90 }} disabled={!provider}>{t('auth.add')}</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
