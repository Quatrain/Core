import React, { useState } from 'react'
import { Card, Text, Group, SimpleGrid, Title, Center, ThemeIcon, Modal, TextInput, Button, Checkbox, Stack } from '@mantine/core'
import { useTranslation } from 'react-i18next'

export function AuthManager() {
  const { t } = useTranslation()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(false)

  // Dynamic fields
  const [pbUrl, setPbUrl] = useState('http://127.0.0.1:8090')
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthSecret, setOauthSecret] = useState('')
  const [jwtIssuer, setJwtIssuer] = useState('')

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    alert(t('auth.devAlert'))
    setIsAddModalOpen(false)
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
          <Center style={{ flexDirection: 'column', gap: '15px' }}>
            <ThemeIcon size={60} radius="xl" variant="light" color="violet">
              <span style={{ fontSize: '30px' }}>+</span>
            </ThemeIcon>
            <Text fw={600} size="lg">{t('auth.addAuth')}</Text>
          </Center>
        </Card>
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
            {['pocketbase', 'oauth', 'jwt'].map(p => (
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

          {provider === 'oauth' && (
            <Stack gap="sm">
              <TextInput label="Client ID" required value={oauthClientId} onChange={e => setOauthClientId(e.currentTarget.value)} />
              <TextInput label="Client Secret" type="password" required value={oauthSecret} onChange={e => setOauthSecret(e.currentTarget.value)} />
            </Stack>
          )}

          {provider === 'jwt' && (
            <TextInput label="Issuer URL" required value={jwtIssuer} onChange={e => setJwtIssuer(e.currentTarget.value)} />
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
