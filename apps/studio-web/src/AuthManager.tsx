import React, { useState, useEffect } from 'react'
import { Card, Text, Group, SimpleGrid, Center, Modal, TextInput, Button, Checkbox, Stack, Badge } from '@mantine/core'
import { ManagerHeader, ManagerGrid, ManagerAddCard, ManagerItemCard } from './components/ManagerUI'
import { useI18n } from './i18nContext'
import { api } from './api'

export function AuthManager() {
  const { t } = useI18n()
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
      <ManagerHeader title={t('auth.title')} description={t('auth.desc')} />

      <ManagerGrid>
        <ManagerAddCard 
          label={t('auth.add')}
          color="violet"
          onClick={() => setIsAddModalOpen(true)}
        />

        {auths.map(a => (
          <ManagerItemCard
            key={a.uid}
            title={a.name}
            onDelete={() => handleDelete(a.uid)}
          >
            <Stack gap="xs" mt="md" style={{ flex: 1 }}>
              <Badge color={a.provider === 'pocketbase' ? 'teal' : a.provider === 'supabase' ? 'green' : a.provider === 'quatrain-oidc' ? 'violet' : 'orange'} variant="light" style={{ alignSelf: 'flex-start' }}>
                {a.provider.toUpperCase()}
              </Badge>
              <Text size="sm" c="dimmed" lineClamp={3}>
                {a.provider === 'pocketbase' && `URL: ${a.options?.url || ''}`}
                {a.provider === 'supabase' && `URL: ${a.options?.url || ''}`}
                {a.provider === 'firebase' && `Project ID: ${a.options?.projectId || ''}`}
                {a.provider === 'quatrain-oidc' && `Serverless OIDC`}
              </Text>
            </Stack>
            {a.isDefault && (
              <Badge color="green" mt="md" fullWidth>Adaptateur par défaut</Badge>
            )}
          </ManagerItemCard>
        ))}
      </ManagerGrid>

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
          <SimpleGrid cols={2} spacing="sm">
            {['pocketbase', 'supabase', 'firebase', 'quatrain-oidc'].map(p => (
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
                  <Text fw={600} size="sm">{p === 'quatrain-oidc' ? 'SERVERLESS OIDC' : p.toUpperCase()}</Text>
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

          {provider === 'quatrain-oidc' && (
            <Text size="sm" c="dimmed" mt="xs">
              L'adaptateur embarqué ne nécessite aucune configuration externe. Le serveur OAuth sera instancié localement au sein de l'API.
            </Text>
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
