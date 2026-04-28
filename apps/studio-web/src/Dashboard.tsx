import { Card, Text, Group, SimpleGrid, Title, ThemeIcon, Button } from '@mantine/core'
import { useTranslation } from 'react-i18next'

export function Dashboard({ models, backends }: { models: any[], backends: any[] }) {
  const { t } = useTranslation()

  // For this mock step, we assume Storages and Auth adapters are just lengths, 
  // but since we don't have them in props yet, we'll display placeholders or count 0.
  const storagesCount = 0; // To be dynamic later
  const authAdaptersCount = 0; // To be dynamic later

  return (
    <div style={{ padding: '20px' }}>
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={2} mb="xs">{t('app.dashboard')}</Title>
          <Text c="dimmed">
            {t('dashboard.overview')}
          </Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        {/* MODELS METRIC */}
        <Card shadow="sm" padding="lg" radius={0} withBorder>
          <Group justify="space-between" mb="xs">
            <Text fw={700} size="lg">{t('app.models') || 'Modèles'}</Text>
            <ThemeIcon size={40} radius="xl" variant="light" color="blue">
              <span style={{ fontSize: '20px' }}>📦</span>
            </ThemeIcon>
          </Group>
          <Text size="3xl" fw={700} style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{models.length}</Text>
          <Text size="sm" c="dimmed" mb="md">{t('dashboard.modelsDesc') || 'Schémas de données définis.'}</Text>
          <Button fullWidth variant="gradient" gradient={{ from: 'blue', to: 'cyan', deg: 90 }} radius="md" onClick={() => window.location.hash = '/models'}>
            {t('dashboard.manageModels', 'Gérer les Modèles')}
          </Button>
        </Card>

        {/* BACKENDS METRIC */}
        <Card shadow="sm" padding="lg" radius={0} withBorder>
          <Group justify="space-between" mb="xs">
            <Text fw={700} size="lg">{t('app.backends')}</Text>
            <ThemeIcon size={40} radius="xl" variant="light" color="teal">
              <span style={{ fontSize: '20px' }}>🗄️</span>
            </ThemeIcon>
          </Group>
          <Text size="3xl" fw={700} style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{backends.length}</Text>
          <Text size="sm" c="dimmed" mb="md">
            {backends.length > 0 ? (
              <>{t('dashboard.activeBackend')} <Text component="span" fw={600} c="teal">{backends[0].name}</Text></>
            ) : (
              t('dashboard.noBackend') || 'Aucun backend actif.'
            )}
          </Text>
          <Button fullWidth variant="gradient" gradient={{ from: 'teal', to: 'green', deg: 90 }} radius="md" onClick={() => window.location.hash = '/backends'}>
            {t('dashboard.manageBackends', 'Gérer les Backends')}
          </Button>
        </Card>

        {/* STORAGES METRIC */}
        <Card shadow="sm" padding="lg" radius={0} withBorder>
          <Group justify="space-between" mb="xs">
            <Text fw={700} size="lg">{t('app.storages')}</Text>
            <ThemeIcon size={40} radius="xl" variant="light" color="grape">
              <span style={{ fontSize: '20px' }}>📂</span>
            </ThemeIcon>
          </Group>
          <Text size="3xl" fw={700} style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{storagesCount}</Text>
          <Text size="sm" c="dimmed" mb="md">{t('dashboard.storagesDesc') || 'Adaptateurs de fichiers.'}</Text>
          <Button fullWidth variant="gradient" gradient={{ from: 'grape', to: 'pink', deg: 90 }} radius="md" onClick={() => window.location.hash = '/storages'}>
            {t('dashboard.manageStorages', 'Gérer les Storages')}
          </Button>
        </Card>

        {/* AUTH METRIC */}
        <Card shadow="sm" padding="lg" radius={0} withBorder>
          <Group justify="space-between" mb="xs">
            <Text fw={700} size="lg">{t('app.auth')}</Text>
            <ThemeIcon size={40} radius="xl" variant="light" color="violet">
              <span style={{ fontSize: '20px' }}>🔐</span>
            </ThemeIcon>
          </Group>
          <Text size="3xl" fw={700} style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{authAdaptersCount}</Text>
          <Text size="sm" c="dimmed" mb="md">{t('dashboard.authDesc') || 'Fournisseurs d\'identité.'}</Text>
          <Button fullWidth variant="gradient" gradient={{ from: 'violet', to: 'grape', deg: 90 }} radius="md" onClick={() => window.location.hash = '/auth'}>
            {t('dashboard.manageAuth', "Gérer l'Authentification")}
          </Button>
        </Card>
      </SimpleGrid>
    </div>
  )
}
