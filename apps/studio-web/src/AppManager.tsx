import { useState, useEffect } from 'react'
import { Card, Text, Group, SimpleGrid, Title, ThemeIcon, Modal, TextInput, Textarea, Button, Stack, ActionIcon, Select, TagsInput, Loader, Badge, Alert } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { api } from './api'

export function AppManager({ onSaved }: { onSaved?: () => void }) {
  const { t } = useTranslation()
  const [project, setProject] = useState<any>(null)
  const [environments, setEnvironments] = useState<any[]>([])
  const [backends, setBackends] = useState<any[]>([])
  const [storages, setStorages] = useState<any[]>([])
  const [auths, setAuths] = useState<any[]>([])
  const [secrets, setSecrets] = useState<any[]>([])
  const [isAddingEnv, setIsAddingEnv] = useState(false)

  // Project form
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [projectDefaultLanguage, setProjectDefaultLanguage] = useState('en')
  const [projectLanguages, setProjectLanguages] = useState<string[]>(['fr'])
  const [projectRecipe, setProjectRecipe] = useState<string | null>(null)
  const [projectAuthMode, setProjectAuthMode] = useState<string>('none')

  // Modals
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false)
  const [newEnvName, setNewEnvName] = useState('')
  const [newEnvType, setNewEnvType] = useState('development')
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<{ success: boolean, message: string } | null>(null)
          
  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const [projs, bks, stgs, aths, secs] = await Promise.all([
        api.getProjects(),
        api.getBackends(),
        api.getStorages(),
        api.getAuths(),
        api.getSecrets()
      ])
      
      let proj = projs.length > 0 ? projs[0] : null
      
      if (proj) {
        setProject(proj)
        setProjectName(proj.name)
        setProjectDesc(proj.description || '')
        setProjectDefaultLanguage(proj.defaultLanguage || 'en')
        setProjectLanguages(proj.languages || ['fr'])
        setProjectRecipe(proj.recipe || null)
        setProjectAuthMode(proj.authMode || 'none')
        
        const envs = await api.getEnvironments(proj.uid)
        setEnvironments(envs)
      } else {
        setProject(null)
      }

      setBackends(bks)
      setStorages(stgs)
      setAuths(aths)
      setSecrets(secs)

    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveProject = async () => {
    try {
      if (project) {
        await api.updateProject(project.uid, { 
           name: projectName, 
           description: projectDesc, 
           defaultLanguage: projectDefaultLanguage,
           languages: projectLanguages,
           recipe: projectRecipe,
           authMode: projectAuthMode
        })
      } else {
        const newProj = await api.createProject({ 
           name: projectName || 'My Application', 
           description: projectDesc, 
           defaultLanguage: projectDefaultLanguage,
           languages: projectLanguages,
           recipe: projectRecipe,
           authMode: projectAuthMode
        })
        await api.createEnvironment({ studioProject: newProj.uid, name: 'Local' })
      }
      // alert 'Saved' could be done using a notification system
      if (onSaved) onSaved()
      loadAll()
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddEnv = async () => {
    if (!newEnvName || !project || isAddingEnv) return
    setIsAddingEnv(true)
    try {
      await api.createEnvironment({ studioProject: project.uid, name: newEnvName, environment: newEnvType })
      setIsEnvModalOpen(false)
      setNewEnvName('')
      setNewEnvType('development')
      loadAll()
    } catch (e) {
      console.error(e)
    } finally {
      setIsAddingEnv(false)
    }
  }

  const handleUpdateEnv = async (envId: string, updates: any) => {
    try {
      await api.updateEnvironment(envId, updates)
      loadAll()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteEnv = async (envId: string) => {
    if (!confirm(t('appManager.deleteEnv'))) return
    try {
      await api.deleteEnvironment(envId)
      loadAll()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeployEnvironment = async (env: any) => {
    if (!project || !project.recipe) return
    setIsDeploying(true)
    setDeployResult(null)
    try {
      const res = await api.deployEnvironment(env.uid, { 
        recipe: project.recipe, 
        authMode: project.authMode || 'none' 
      })
      if (res && res.success) {
        setDeployResult({ success: true, message: t('appManager.deploySuccess') })
      } else {
        setDeployResult({ success: false, message: `${t('appManager.deployError')} ${res.error}` })
      }
    } catch (e: any) {
      console.error(e)
      setDeployResult({ success: false, message: `${t('appManager.deployError')} ${e.message}` })
    } finally {
      setIsDeploying(false)
    }
  }

  const backendOptions = backends.map(b => ({ value: b.uid, label: b.name }))
  const storageOptions = storages.map(s => ({ value: s.uid, label: s.name }))
  const authOptions = auths.map(a => ({ value: a.uid, label: a.name }))

  return (
    <div style={{ padding: '20px' }}>
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={2} mb="xs">{t('appManager.title')}</Title>
          <Text c="dimmed">{t('appManager.desc')}</Text>
        </div>
      </Group>

      {!project && (
        <Alert title="Attention" color="yellow" mb="xl">
          {t('appManager.notConfiguredAlert')}
        </Alert>
      )}

      {/* Project Card */}
      <Card shadow="sm" padding="lg" radius={0} withBorder mb="xl">
        <Stack gap="md">
          <TextInput 
            label={t('appManager.appName')} 
            value={projectName} 
            onChange={(e) => setProjectName(e.currentTarget.value)} 
            radius="md"
          />
          <Textarea 
            label={t('appManager.appDesc')} 
            value={projectDesc} 
            onChange={(e) => setProjectDesc(e.currentTarget.value)} 
            radius="md"
            minRows={3}
          />
          <Select
            label={t('appManager.recipeLabel') || "Recette (Template) de l'application"}
            placeholder="-"
            data={[{ value: 'crud', label: t('appManager.recipeCrud') || 'CRUD App (Engine unifié)' }]}
            value={projectRecipe}
            onChange={setProjectRecipe}
            clearable
            radius="md"
          />
          <Select
            label={t('appManager.authMode')}
            placeholder="-"
            data={[
              { value: 'none', label: t('appManager.authNone') },
              { value: 'basic', label: t('appManager.authBasic') },
              { value: 'oauth', label: t('appManager.authOAuth') }
            ]}
            value={projectAuthMode}
            onChange={(val) => setProjectAuthMode(val || 'none')}
            clearable={false}
            radius="md"
          />
          <TextInput
            label={t('appManager.defaultLanguage') || 'Langue par défaut'}
            placeholder="ex: en"
            value={projectDefaultLanguage}
            onChange={(e) => setProjectDefaultLanguage(e.currentTarget.value)}
            radius="md"
            required
          />
          <TagsInput
            label={t('appManager.languages') || 'Langues supportées'}
            description="Entrez les codes pays (ex: fr, en, es). Appuyez sur Entrée pour valider."
            placeholder="Ajouter une langue"
            value={projectLanguages}
            onChange={setProjectLanguages}
            radius="md"
          />
          <Button onClick={handleSaveProject} style={{ alignSelf: 'flex-start' }} radius="md" color="blue">
            {t('appManager.saveApp')}
          </Button>
        </Stack>
      </Card>

      <Title order={3} mb="lg">{t('appManager.environments')}</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {/* BIG ADD ENV CARD */}
        <Card 
          shadow="sm" 
          padding="lg" 
          radius={0} 
          withBorder
          onClick={() => setIsEnvModalOpen(true)}
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
            e.currentTarget.style.borderColor = 'var(--mantine-color-green-filled)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)'
            e.currentTarget.style.borderColor = 'var(--mantine-color-dimmed)'
          }}
        >
          <Stack align="center" gap="xs">
            <ThemeIcon size={60} radius="xl" variant="light" color="green">
              <span style={{ fontSize: '30px' }}>+</span>
            </ThemeIcon>
            <Text fw={600} size="lg" mt="md" c="dimmed">
              {t('appManager.addEnv')}
            </Text>
          </Stack>
        </Card>

        {environments.map(env => (
          <Card 
            key={env.uid} 
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
                <Group gap="xs">
                  <Text fw={700} size="lg">{env.name}</Text>
                  {env.environment && (
                    <Badge color={env.environment === 'production' ? 'red' : env.environment === 'staging' ? 'yellow' : 'green'} variant="light">
                      {env.environment}
                    </Badge>
                  )}
                </Group>
                <ActionIcon variant="light" color="red" onClick={() => handleDeleteEnv(env.uid)}>
                  ✖
                </ActionIcon>
              </Group>
            </Card.Section>
            
            <Stack gap="sm" mt="md" style={{ flex: 1 }}>
              <Select
                label={t('appManager.backend')}
                placeholder="-"
                data={backendOptions}
                value={env.studioBackend || null}
                onChange={(val) => handleUpdateEnv(env.uid, { studioBackend: val })}
                clearable
                radius="md"
              />

              <Select
                label={t('appManager.storage')}
                placeholder="-"
                data={storageOptions}
                value={env.studioStorage || null}
                onChange={(val) => handleUpdateEnv(env.uid, { studioStorage: val })}
                clearable
                radius="md"
              />

              <Select
                label={t('appManager.auth')}
                placeholder="-"
                data={authOptions}
                value={env.studioAuth || null}
                onChange={(val) => handleUpdateEnv(env.uid, { studioAuth: val })}
                clearable
                radius="md"
              />

              <Button variant="light" color="violet" mt="auto" radius="md" onClick={() => { window.location.hash = '/secrets' }}>
                {t('appManager.secrets')} ({secrets.filter(s => s.environmentId === env.uid).length})
              </Button>
              <Button 
                variant="gradient" 
                gradient={{ from: 'indigo', to: 'cyan' }} 
                radius="md" 
                onClick={() => handleDeployEnvironment(env)}
                disabled={!project?.recipe}
              >
                Déployer l'environnement
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      {/* Add Environment Modal */}
      <Modal opened={isEnvModalOpen} onClose={() => setIsEnvModalOpen(false)} title={t('appManager.addEnv')}>
        <Stack>
          <TextInput 
            label={t('appManager.envName')}
            value={newEnvName}
            onChange={(e) => setNewEnvName(e.currentTarget.value)}
            radius="md"
          />
          <Select
            label={t('appManager.environment')}
            data={[
               { value: 'development', label: 'Development' },
               { value: 'staging', label: 'Staging' },
               { value: 'production', label: 'Production' }
            ]}
            value={newEnvType}
            onChange={(val) => setNewEnvType(val || 'development')}
            clearable={false}
            radius="md"
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setIsEnvModalOpen(false)} radius="md" disabled={isAddingEnv}>{t('appManager.cancel')}</Button>
            <Button color="green" onClick={handleAddEnv} radius="md" loading={isAddingEnv}>{t('appManager.add')}</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={isDeploying || deployResult !== null}
        onClose={() => { if (!isDeploying) setDeployResult(null) }}
        title={<Text fw={600} size="lg">{t('appManager.deployEnv')}</Text>}
        centered
        closeOnClickOutside={!isDeploying}
        withCloseButton={!isDeploying}
      >
        <Stack align="center" gap="lg" py="xl">
          {isDeploying ? (
            <>
              <Loader size="xl" type="bars" color="violet" />
              <Text fw={500}>{t('appManager.deploying')}</Text>
            </>
          ) : deployResult && (
            <>
              <ThemeIcon size={80} radius="xl" color={deployResult.success ? "green" : "red"} variant="light">
                <span style={{ fontSize: '40px' }}>{deployResult.success ? "✓" : "✖"}</span>
              </ThemeIcon>
              <Text fw={600} size="md" c={deployResult.success ? "green" : "red"} ta="center">
                {deployResult.message}
              </Text>
              <Button mt="md" fullWidth variant="light" color={deployResult.success ? "green" : "red"} onClick={() => setDeployResult(null)}>
                OK
              </Button>
            </>
          )}
        </Stack>
      </Modal>
    </div>
  )
}
