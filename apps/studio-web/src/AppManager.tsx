import React, { useState, useEffect } from 'react'
import { Card, Text, Group, SimpleGrid, Title, Center, ThemeIcon, Modal, TextInput, Textarea, Button, Stack, ActionIcon, Select, Badge, Divider, Table } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { api } from './api'

export function AppManager() {
  const { t } = useTranslation()
  const [project, setProject] = useState<any>(null)
  const [environments, setEnvironments] = useState<any[]>([])
  const [backends, setBackends] = useState<any[]>([])
  const [storages, setStorages] = useState<any[]>([])
  const [auths, setAuths] = useState<any[]>([])
  const [secrets, setSecrets] = useState<any[]>([])

  // Project form
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')

  // Modals
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false)
  const [newEnvName, setNewEnvName] = useState('')

  const [activeSecretEnv, setActiveSecretEnv] = useState<any>(null)
  const [newKeychainName, setNewKeychainName] = useState('')
  const [newVarKey, setNewVarKey] = useState('')
  const [newVarValue, setNewVarValue] = useState('')
  const [activeKeychainForVar, setActiveKeychainForVar] = useState<string | null>(null)

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
      if (!proj) {
        proj = await api.createProject({ name: 'My Application' })
        // Create default local environment
        await api.createEnvironment({ projectId: proj.uid, name: 'Local' })
      }
      setProject(proj)
      setProjectName(proj.name)
      setProjectDesc(proj.description || '')

      setBackends(bks)
      setStorages(stgs)
      setAuths(aths)
      setSecrets(secs)

      const envs = await api.getEnvironments(proj.uid)
      setEnvironments(envs)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveProject = async () => {
    if (!project) return
    try {
      await api.updateProject(project.uid, { name: projectName, description: projectDesc })
      // alert 'Saved' could be done using a notification system
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddEnv = async () => {
    if (!newEnvName || !project) return
    try {
      await api.createEnvironment({ projectId: project.uid, name: newEnvName })
      setIsEnvModalOpen(false)
      setNewEnvName('')
      loadAll()
    } catch (e) {
      console.error(e)
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

  const handleCreateKeychain = async () => {
    if (!activeSecretEnv || !newKeychainName) return
    try {
      await api.createSecret({
        name: newKeychainName,
        values: {},
        environmentId: activeSecretEnv.uid
      })
      setNewKeychainName('')
      loadAll()
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddVariable = async () => {
    if (!activeKeychainForVar || !newVarKey || !newVarValue) return
    try {
      const secret = secrets.find(s => s.uid === activeKeychainForVar)
      if (!secret) return
      const updatedValues = { ...secret.values, [newVarKey]: newVarValue }
      await api.updateSecret(activeKeychainForVar, { values: updatedValues })
      setNewVarKey('')
      setNewVarValue('')
      loadAll()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteVariable = async (secretId: string, key: string) => {
    try {
      const secret = secrets.find(s => s.uid === secretId)
      if (!secret) return
      const updatedValues = { ...secret.values }
      delete updatedValues[key]
      await api.updateSecret(secretId, { values: updatedValues })
      loadAll()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteSecret = async (secretId: string) => {
    try {
      await api.deleteSecret(secretId)
      loadAll()
    } catch (e) {
      console.error(e)
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
                <Text fw={700} size="lg">{env.name}</Text>
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
                value={env.backendId || null}
                onChange={(val) => handleUpdateEnv(env.uid, { backendId: val })}
                clearable
                radius="md"
              />
              {env.backendId && (
                <Select
                  placeholder="Trousseau de secrets"
                  data={secrets.filter(s => s.environmentId === env.uid).map(s => ({ value: s.uid, label: s.name }))}
                  value={env.backendSecretId || null}
                  onChange={(val) => handleUpdateEnv(env.uid, { backendSecretId: val })}
                  clearable
                  radius="md"
                  size="xs"
                />
              )}

              <Select
                label={t('appManager.storage')}
                placeholder="-"
                data={storageOptions}
                value={env.storageId || null}
                onChange={(val) => handleUpdateEnv(env.uid, { storageId: val })}
                clearable
                radius="md"
              />
              {env.storageId && (
                <Select
                  placeholder="Trousseau de secrets"
                  data={secrets.filter(s => s.environmentId === env.uid).map(s => ({ value: s.uid, label: s.name }))}
                  value={env.storageSecretId || null}
                  onChange={(val) => handleUpdateEnv(env.uid, { storageSecretId: val })}
                  clearable
                  radius="md"
                  size="xs"
                />
              )}

              <Select
                label={t('appManager.auth')}
                placeholder="-"
                data={authOptions}
                value={env.authId || null}
                onChange={(val) => handleUpdateEnv(env.uid, { authId: val })}
                clearable
                radius="md"
              />
              {env.authId && (
                <Select
                  placeholder="Trousseau de secrets"
                  data={secrets.filter(s => s.environmentId === env.uid).map(s => ({ value: s.uid, label: s.name }))}
                  value={env.authSecretId || null}
                  onChange={(val) => handleUpdateEnv(env.uid, { authSecretId: val })}
                  clearable
                  radius="md"
                  size="xs"
                />
              )}

              <Button variant="light" color="violet" mt="auto" radius="md" onClick={() => setActiveSecretEnv(env)}>
                {t('appManager.secrets')} ({secrets.filter(s => s.environmentId === env.uid).length})
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
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setIsEnvModalOpen(false)} radius="md">{t('appManager.cancel')}</Button>
            <Button color="green" onClick={handleAddEnv} radius="md">{t('appManager.add')}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Secrets Modal */}
      <Modal opened={!!activeSecretEnv} onClose={() => setActiveSecretEnv(null)} title={`${t('appManager.secrets')} - ${activeSecretEnv?.name}`} size="lg">
        <Stack>
          {secrets.filter(s => s.environmentId === activeSecretEnv?.uid).map(keychain => (
            <Card key={keychain.uid} withBorder radius="md" p="sm">
              <Group justify="space-between" mb="xs">
                <Text fw={700}>{keychain.name}</Text>
                <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteSecret(keychain.uid)}>✖</ActionIcon>
              </Group>
              <Table>
                <Table.Tbody>
                  {Object.keys(keychain.values || {}).map(k => (
                    <Table.Tr key={k}>
                      <Table.Td><Badge color="gray">{k}</Badge></Table.Td>
                      <Table.Td>••••••••••••</Table.Td>
                      <Table.Td>
                        <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteVariable(keychain.uid, k)}>✖</ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          ))}

          <Divider my="sm" />
          
          <Title order={5}>Ajouter une variable</Title>
          <Group align="flex-end">
            <Select 
              label="Trousseau"
              data={secrets.filter(s => s.environmentId === activeSecretEnv?.uid).map(s => ({ value: s.uid, label: s.name }))}
              value={activeKeychainForVar}
              onChange={setActiveKeychainForVar}
              style={{ flex: 1 }}
              radius="md"
            />
            <TextInput 
              label={t('appManager.secretName')}
              value={newVarKey}
              onChange={(e) => setNewVarKey(e.currentTarget.value)}
              style={{ flex: 1 }}
              radius="md"
            />
            <TextInput 
              label={t('appManager.secretValue')}
              value={newVarValue}
              onChange={(e) => setNewVarValue(e.currentTarget.value)}
              type="password"
              style={{ flex: 1 }}
              radius="md"
            />
            <Button onClick={handleAddVariable} radius="md" color="violet">{t('appManager.add')}</Button>
          </Group>

          <Divider my="sm" />
          <Title order={5}>Nouveau Trousseau</Title>
          <Group align="flex-end">
            <TextInput 
              label="Nom du trousseau"
              value={newKeychainName}
              onChange={(e) => setNewKeychainName(e.currentTarget.value)}
              style={{ flex: 1 }}
              radius="md"
            />
            <Button onClick={handleCreateKeychain} radius="md" color="gray">{t('appManager.add')}</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}
