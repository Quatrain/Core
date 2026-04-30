import { useState, useEffect } from 'react'
import { Card, Text, Group, SimpleGrid, Title, ThemeIcon, Modal, TextInput, Select, Button, Stack, ActionIcon, Badge, Table, Center } from '@mantine/core'
import { api } from './api'

export function SecretsManager() {
  const [environments, setEnvironments] = useState<any[]>([])
  const [secrets, setSecrets] = useState<any[]>([])
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null)
  
  const [isAddKeychainModalOpen, setIsAddKeychainModalOpen] = useState(false)
  const [newKeychainName, setNewKeychainName] = useState('')

  const [activeKeychain, setActiveKeychain] = useState<any>(null)
  const [newVarKey, setNewVarKey] = useState('')
  const [newVarValue, setNewVarValue] = useState('')
  const [revealedVars, setRevealedVars] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const projs = await api.getProjects()
      if (projs.length > 0) {
        const envs = await api.getEnvironments(projs[0].uid)
        setEnvironments(envs)
        if (envs.length > 0 && !activeEnvId) {
          setActiveEnvId(envs[0].uid)
        }
      }
      const secs = await api.getSecrets()
      setSecrets(secs)
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateKeychain = async () => {
    if (!activeEnvId || !newKeychainName) return
    try {
      await api.createSecret({
        name: newKeychainName,
        values: {},
        environmentId: activeEnvId
      })
      setNewKeychainName('')
      setIsAddKeychainModalOpen(false)
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteKeychain = async (secretId: string) => {
    if (!confirm('Supprimer ce trousseau de secrets ?')) return
    try {
      await api.deleteSecret(secretId)
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddVariable = async () => {
    if (!activeKeychain || !newVarKey || !newVarValue) return
    try {
      const updatedValues = { ...activeKeychain.values, [newVarKey]: newVarValue }
      await api.updateSecret(activeKeychain.uid, { values: updatedValues })
      setNewVarKey('')
      setNewVarValue('')
      
      // Update local state to reflect immediately
      setActiveKeychain({...activeKeychain, values: updatedValues})
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteVariable = async (key: string) => {
    if (!activeKeychain) return
    try {
      const updatedValues = { ...activeKeychain.values }
      delete updatedValues[key]
      await api.updateSecret(activeKeychain.uid, { values: updatedValues })
      
      // Update local state
      setActiveKeychain({...activeKeychain, values: updatedValues})
      loadData()
    } catch (e) {
      console.error(e)
    }
  }

  const toggleReveal = (key: string) => {
    setRevealedVars(prev => ({...prev, [key]: !prev[key]}))
  }

  const activeSecrets = secrets.filter(s => s.environmentId === activeEnvId)

  return (
    <div style={{ padding: '20px' }}>
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={2} mb="xs">Gestion des Secrets</Title>
          <Text c="dimmed">Stockage sécurisé de vos variables d'environnement (clés API, mots de passe).</Text>
        </div>
      </Group>

      {environments.length > 0 ? (
        <Group mb="xl" align="center">
          <Text fw={600}>Environnement :</Text>
          <Select 
            data={environments.map(e => ({value: e.uid, label: e.name}))}
            value={activeEnvId}
            onChange={setActiveEnvId}
            allowDeselect={false}
            style={{ width: '250px' }}
          />
        </Group>
      ) : (
        <Text c="red" mb="xl">Aucun environnement trouvé. Veuillez en créer un dans l'onglet Application.</Text>
      )}

      {activeEnvId && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {/* ADD KEYCHAIN CARD */}
          <Card 
            shadow="sm" 
            padding="lg" 
            radius="md" 
            withBorder
            onClick={() => setIsAddKeychainModalOpen(true)}
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
                Nouveau Trousseau
              </Text>
            </Stack>
          </Card>

          {/* KEYCHAINS CARDS */}
          {activeSecrets.map(keychain => {
            const varCount = Object.keys(keychain.values || {}).length
            return (
              <Card 
                key={keychain.uid} 
                shadow="sm" 
                padding="lg" 
                radius="md" 
                withBorder
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <Group justify="space-between" mb="md">
                  <Group>
                    <ThemeIcon color="violet" variant="light"><span style={{fontSize: '18px'}}>🔐</span></ThemeIcon>
                    <Text fw={700} size="lg">{keychain.name}</Text>
                  </Group>
                  <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteKeychain(keychain.uid)}>
                    ✖
                  </ActionIcon>
                </Group>
                
                <Text size="sm" c="dimmed" mb="xl">
                  Ce trousseau contient {varCount} variable{varCount !== 1 ? 's' : ''}.
                </Text>

                <Button variant="light" color="violet" mt="auto" onClick={() => setActiveKeychain(keychain)}>
                  Gérer les variables
                </Button>
              </Card>
            )
          })}
        </SimpleGrid>
      )}

      {/* Add Keychain Modal */}
      <Modal opened={isAddKeychainModalOpen} onClose={() => setIsAddKeychainModalOpen(false)} title="Créer un nouveau trousseau">
        <Stack>
          <TextInput 
            label="Nom du trousseau"
            placeholder="ex: Production API Keys"
            value={newKeychainName}
            onChange={(e) => setNewKeychainName(e.currentTarget.value)}
            data-autofocus
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setIsAddKeychainModalOpen(false)}>Annuler</Button>
            <Button color="violet" onClick={handleCreateKeychain} disabled={!newKeychainName}>Créer</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Manage Variables Modal */}
      <Modal 
        opened={!!activeKeychain} 
        onClose={() => { setActiveKeychain(null); setRevealedVars({}); }} 
        title={`Trousseau : ${activeKeychain?.name}`} 
        size="lg"
      >
        <Stack>
          {activeKeychain && Object.keys(activeKeychain.values || {}).length > 0 ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Clé</Table.Th>
                  <Table.Th>Valeur</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.entries(activeKeychain.values || {}).map(([k, v]) => (
                  <Table.Tr key={k}>
                    <Table.Td><Badge color="gray" style={{textTransform: 'none'}}>{k}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Text style={{ fontFamily: 'monospace', letterSpacing: revealedVars[k] ? 'normal' : '2px' }}>
                          {revealedVars[k] ? String(v) : '••••••••••••'}
                        </Text>
                        <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => toggleReveal(k)} title={revealedVars[k] ? "Masquer" : "Afficher"}>
                          {revealedVars[k] ? '👁️‍🗨️' : '👁️'}
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteVariable(k)}>✖</ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Center p="xl"><Text c="dimmed" fs="italic">Aucune variable dans ce trousseau.</Text></Center>
          )}

          <Card withBorder mt="md" radius="md">
            <Text fw={600} mb="sm">Ajouter une variable</Text>
            <Group align="flex-end">
              <TextInput 
                label="Clé"
                placeholder="ex: STRIPE_API_KEY"
                value={newVarKey}
                onChange={(e) => setNewVarKey(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <TextInput 
                label="Valeur"
                placeholder="Valeur secrète"
                value={newVarValue}
                onChange={(e) => setNewVarValue(e.currentTarget.value)}
                type="password"
                style={{ flex: 1 }}
              />
              <Button onClick={handleAddVariable} color="violet" disabled={!newVarKey || !newVarValue}>Ajouter</Button>
            </Group>
          </Card>
        </Stack>
      </Modal>

    </div>
  )
}
