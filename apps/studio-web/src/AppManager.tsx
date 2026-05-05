import { useState, useEffect } from 'react'
import { Card, Text, Group, Modal, TextInput, Textarea, Button, Stack, Select, TagsInput, Loader, Badge, Alert, Title, ThemeIcon } from '@mantine/core'
import { ManagerHeader, ManagerGrid, ManagerAddCard, ManagerItemCard } from './components/ManagerUI'
import { useTranslation } from 'react-i18next'
import { api, API_BASE_URL } from './api'

export function AppManager({ onSaved }: { onSaved?: () => void }) {
  const { t } = useTranslation()
  const [project, setProject] = useState<any>(null)
  const [environments, setEnvironments] = useState<any[]>([])
  const [backends, setBackends] = useState<any[]>([])
  const [storages, setStorages] = useState<any[]>([])
  const [auths, setAuths] = useState<any[]>([])
  const [secrets, setSecrets] = useState<any[]>([])
  const [targets, setTargets] = useState<any[]>([])
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
  const [deploySteps, setDeploySteps] = useState<any[]>([])
  const [deployResult, setDeployResult] = useState<{ success: boolean, message: string } | null>(null)
          
  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const [projs, bks, stgs, aths, secs, tgts] = await Promise.all([
        api.getProjects(),
        api.getBackends(),
        api.getStorages(),
        api.getAuths(),
        api.getSecrets(),
        api.getTargets()
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
      setTargets(tgts || [])

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
    setDeploySteps([])
    try {
      const response = await fetch(`${API_BASE_URL}/environments/${env.uid}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          recipe: project.recipe, 
          authMode: project.authMode || 'none' 
        })
      })

      if (!response.body) throw new Error('No readable stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(Boolean)
        
        for (const line of lines) {
           try {
              const event = JSON.parse(line)
              setDeploySteps(prev => {
                 const newSteps = [...prev]
                 const existingIdx = newSteps.findIndex(s => s.step === event.step)
                 if (existingIdx >= 0) {
                    newSteps[existingIdx] = event
                 } else {
                    newSteps.push(event)
                 }
                 return newSteps
              })
              if (event.step === 'done') {
                 setDeployResult({ success: true, message: event.message })
              } else if (event.status === 'error') {
                 setDeployResult({ success: false, message: event.message })
              }
           } catch (e) {}
        }
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
  const targetOptions = targets.map(t => ({ value: t.uid, label: t.name }))

  return (
    <div style={{ padding: '20px' }}>
      <ManagerHeader title={t('appManager.title')} description={t('appManager.desc')} />

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

      <ManagerGrid>
        <ManagerAddCard 
          label={t('appManager.addEnv')}
          color="green"
          onClick={() => setIsEnvModalOpen(true)}
        />

        {environments.map(env => (
          <ManagerItemCard
            key={env.uid}
            title={
              <Group gap="xs">
                <Text fw={700} size="lg">{env.name}</Text>
                {env.environment && (
                  <Badge color={env.environment === 'production' ? 'red' : env.environment === 'staging' ? 'yellow' : 'green'} variant="light">
                    {env.environment}
                  </Badge>
                )}
              </Group>
            }
            onDelete={() => handleDeleteEnv(env.uid)}
          >
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

              <Select
                label="Cible de déploiement"
                placeholder="-"
                data={targetOptions}
                value={env.studioTarget || null}
                onChange={(val) => handleUpdateEnv(env.uid, { studioTarget: val })}
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
          </ManagerItemCard>
        ))}
      </ManagerGrid>

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
        <Stack align="center" gap="lg" py="xl" style={{ width: '100%' }}>
          {deploySteps.length > 0 || isDeploying ? (
            <Stack style={{ width: '100%' }} gap="md">
               {deploySteps.map((step, idx) => (
                  <Group key={idx} align="center">
                     {step.status === 'running' ? <Loader size="sm" color="violet" /> : 
                      step.status === 'success' ? <ThemeIcon size="sm" color="green" radius="xl"><span style={{fontSize:'12px'}}>✓</span></ThemeIcon> :
                      step.status === 'error' ? <ThemeIcon size="sm" color="red" radius="xl"><span style={{fontSize:'12px'}}>✖</span></ThemeIcon> : <Loader size="sm" color="violet" />}
                     <Text fw={step.status === 'running' ? 600 : 400} c={step.status === 'error' ? 'red' : undefined} style={{ flex: 1 }}>{step.message}</Text>
                  </Group>
               ))}
               {deployResult && (
                 <Button mt="xl" fullWidth variant="light" color={deployResult.success ? "green" : "red"} onClick={() => setDeployResult(null)}>
                   OK
                 </Button>
               )}
            </Stack>
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
