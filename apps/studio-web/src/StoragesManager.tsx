import React, { useState } from 'react'
import { Card, Text, Group, SimpleGrid, Title, Center, ThemeIcon, ActionIcon, Modal, TextInput, Select, Button } from '@mantine/core'
import { useTranslation } from 'react-i18next'

export function StoragesManager() {
  const { t } = useTranslation()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<string | null>(null)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    alert(t('storages.devAlert'))
    setIsAddModalOpen(false)
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
          radius="md" 
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
          <Center style={{ flexDirection: 'column', gap: '15px' }}>
            <ThemeIcon size={60} radius="xl" variant="light" color="blue">
              <span style={{ fontSize: '30px' }}>+</span>
            </ThemeIcon>
            <Text fw={600} size="lg">{t('storages.addStorage')}</Text>
          </Center>
        </Card>
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
          <Select 
            label={t('storages.provider')}
            placeholder={t('storages.selectProvider')}
            value={provider}
            onChange={setProvider}
            data={[
              { value: 's3', label: 'Amazon S3' },
              { value: 'local', label: 'Stockage Local' },
              { value: 'gcs', label: 'Google Cloud Storage' }
            ]}
            required
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={() => setIsAddModalOpen(false)}>{t('storages.cancel')}</Button>
            <Button type="submit" color="blue">{t('storages.add')}</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
