import { useState, useEffect } from 'react'
import { Button, TextInput, Select as MantineSelect, Checkbox as MantineCheckbox, AppShell, Group, Title, ActionIcon, useMantineColorScheme, Stack, NavLink, Badge, Card, SimpleGrid, Paper, Center, ThemeIcon, Text } from '@mantine/core'
import { api } from './api'
import { PropertyOptionsEditor } from './PropertyOptionsEditor'
import { Dashboard } from './Dashboard'
import { BackendsManager } from './BackendsManager'
import { StoragesManager } from './StoragesManager'
import { AuthManager } from './AuthManager'
import { CreateModel } from './CreateModel'
import { I18nextProvider, useTranslation } from 'react-i18next'
import i18n from './i18n'

// Import Logo
import logoUrl from '../../../assets/quatrain-logo.png'

function AppContent() {
  const { t } = useTranslation()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const [models, setModels] = useState<any[]>([])
  const [backends, setBackends] = useState<any[]>([])
  const [currentModel, setCurrentModel] = useState<any>(null)
  const [currentView, setCurrentView] = useState<'dashboard' | 'backends' | 'storages' | 'auth' | 'model' | 'new-model'>('dashboard')
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)

  // DnD state
  const [draggedPropId, setDraggedPropId] = useState<string | null>(null)
  const [dragOverPropId, setDragOverPropId] = useState<string | null>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null)

  // Deploy state
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)
  const [selectedBackendForDeploy, setSelectedBackendForDeploy] = useState<string>('')
  const [deployError, setDeployError] = useState<string | null>(null)

  // Forms State
  const [modelName, setModelName] = useState('')
  const [collectionName, setCollectionName] = useState('')
  
  const [propName, setPropName] = useState('')
  const [propType, setPropType] = useState<string | null>(null)
  const [isMandatory, setIsMandatory] = useState(false)
  const [propOptions, setPropOptions] = useState<any>({})

  // Load models on startup
  useEffect(() => {
    loadModels()
  }, [])

  // Load properties when selected version changes
  useEffect(() => {
    if (currentModel && selectedVersion !== null) {
      api.getModelProperties(currentModel.uid, selectedVersion)
         .then(props => setProperties(props))
         .catch(console.error)
    }
  }, [currentModel, selectedVersion])

  // Simple Hash Routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (hash && hash.startsWith('/models/new')) {
        setCurrentModel(null)
        setCurrentView('new-model')
      } else if (hash && hash.startsWith('/models/')) {
        const name = hash.split('/models/')[1]
        const foundModel = models.find((m: any) => m.name === name)
        // Only load if not already loaded to avoid infinite loops
        if (foundModel && currentModel?.uid !== foundModel.uid) {
          loadModelDetails(foundModel.uid)
        }
        setCurrentView('model')
      } else if (hash === '/backends') {
        setCurrentModel(null)
        setCurrentView('backends')
      } else if (hash === '/storages') {
        setCurrentModel(null)
        setCurrentView('storages')
      } else if (hash === '/auth') {
        setCurrentModel(null)
        setCurrentView('auth')
      } else if (!hash || hash === '/') {
        setCurrentModel(null)
        setCurrentView('dashboard')
      }
    }

    if (models.length > 0) {
       handleHashChange()
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [models])

  const loadModels = async () => {
    try {
      const data = await api.getModels()
      setModels(data)
      const backs = await api.getBackends()
      setBackends(backs)
    } catch (e) {
      console.error(e)
    }
  }

  const loadModelDetails = async (id: string) => {
    try {
      const model = await api.getModel(id)
      setCurrentModel(model)
      setSelectedVersion(model.version || 1)
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateModel = async (name: string, collection: string) => {
    try {
      const newModel = await api.createModel(name, collection)
      setCurrentModel(newModel)
      setProperties([])
      loadModels() // Refresh sidebar list
      window.location.hash = `/models/${newModel.name}`
    } catch (e) {
      setError((e as Error).message)
      console.error(e)
    }
  }

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentModel || !propType) return
    try {
      if (editingPropertyId) {
        await api.updateProperty(editingPropertyId, {
          name: propName,
          propertyType: propType,
          mandatory: isMandatory,
          options: propOptions
        })
      } else {
        await api.addProperty(currentModel.uid, {
          name: propName,
          propertyType: propType,
          mandatory: isMandatory,
          options: propOptions,
          version: currentModel.version || 1,
          order: properties.length
        })
      }
      // Reload properties
      const props = await api.getModelProperties(currentModel.uid, currentModel.version || 1)
      setProperties(props)
      cancelEditProperty()
    } catch (e) {
      setError((e as Error).message)
      console.error(e)
    }
  }

  const handleEditProperty = (prop: any) => {
    setEditingPropertyId(prop.uid)
    setPropName(prop.name)
    setPropType(prop.propertyType)
    setIsMandatory(prop.mandatory)
    setPropOptions(prop.options || {})
  }

  const cancelEditProperty = () => {
    setEditingPropertyId(null)
    setPropName('')
    setPropType(null)
    setIsMandatory(false)
    setPropOptions({})
  }

  const handleUpdateModel = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const updatedModel = await api.updateModel(currentModel.uid, {
        name: currentModel.name,
        collectionName: currentModel.collectionName,
        isPersisted: currentModel.isPersisted
      })
      setCurrentModel(updatedModel)
      loadModels() // Refresh sidebar list
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleDeleteProperty = async (propId: string) => {
    if (!confirm('Supprimer cette propriété ?')) return
    try {
      await api.deleteProperty(propId)
      const props = await api.getModelProperties(currentModel.uid, selectedVersion || 1)
      setProperties(props)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleVersionner = async () => {
    if (!currentModel) return;
    try {
      const currentVer = currentModel.version || 1;
      const nextVer = currentVer + 1;
      
      const updatedModel = await api.updateModel(currentModel.uid, { version: nextVer });
      setCurrentModel(updatedModel);
      
      const currentProps = await api.getModelProperties(currentModel.uid, currentVer);
      for (const p of currentProps) {
        const { uid, _id, ...propData } = p;
        await api.addProperty(currentModel.uid, { ...propData, version: nextVer });
      }
      
      setSelectedVersion(nextVer);
      loadModels();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const handleRestaurer = async () => {
    if (!currentModel || !selectedVersion) return;
    try {
      const currentVer = currentModel.version || 1;
      
      const draftProps = await api.getModelProperties(currentModel.uid, currentVer);
      for (const p of draftProps) {
        await api.deleteProperty(p.uid);
      }
      
      const oldProps = await api.getModelProperties(currentModel.uid, selectedVersion);
      for (const p of oldProps) {
        const { uid, _id, ...propData } = p;
        await api.addProperty(currentModel.uid, { ...propData, version: currentVer });
      }
      
      setSelectedVersion(currentVer);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const handleDeployClick = () => {
    if (backends.length === 0) {
      setIsDeployModalOpen(true)
    } else if (backends.length === 1) {
      // Un seul backend, on déploie directement
      executeDeploy(backends[0].uid)
    } else {
      // Plusieurs backends : on préselectionne le par défaut s'il existe
      const defaultBackend = backends.find(b => b.isDefault)
      setSelectedBackendForDeploy(defaultBackend ? defaultBackend.uid : backends[0].uid)
      setIsDeployModalOpen(true)
    }
  }

  const executeDeploy = async (backendId: string) => {
    try {
      setDeployError(null)
      await api.deployModel(currentModel.uid, selectedVersion || 1, backendId)
      alert("✅ Modèle déployé avec succès sur le backend cible !")
      setIsDeployModalOpen(false)
      loadModels() // refresh models and backends
    } catch (e: any) {
      setDeployError(e.response?.data?.message || e.message)
    }
  }

  const sortedProperties = [...properties].sort((a, b) => (a.order || 0) - (b.order || 0))

  const handleDragStart = (e: React.DragEvent, uid: string) => {
    e.dataTransfer.effectAllowed = 'move'
    setDraggedPropId(uid)
  }

  const handleDragOver = (e: React.DragEvent, uid: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (uid !== dragOverPropId) {
      setDragOverPropId(uid)
    }
  }

  const handleDrop = async (e: React.DragEvent, targetUid: string) => {
    e.preventDefault()
    setDragOverPropId(null)
    
    if (!draggedPropId || draggedPropId === targetUid) return

    const oldIndex = sortedProperties.findIndex(p => p.uid === draggedPropId)
    const newIndex = sortedProperties.findIndex(p => p.uid === targetUid)
    
    if (oldIndex === -1 || newIndex === -1) return

    const newSorted = [...sortedProperties]
    const [moved] = newSorted.splice(oldIndex, 1)
    newSorted.splice(newIndex, 0, moved)

    const updatedProperties = newSorted.map((p, index) => ({...p, order: index}))
    setProperties(updatedProperties)

    try {
      const promises = []
      for (const p of updatedProperties) {
         const originalProp = properties.find(op => op.uid === p.uid)
         if (originalProp && originalProp.order !== p.order) {
           promises.push(api.updateProperty(p.uid, { order: p.order }))
         }
      }
      await Promise.all(promises)
    } catch (err) {
      setError((err as Error).message)
    }
    
    setDraggedPropId(null)
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      footer={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group style={{ cursor: 'pointer' }} onClick={() => { window.location.hash = '/' }}>
            <Title order={3} style={{ fontFamily: 'Inter, sans-serif' }}>{t('app.title')}</Title>
          </Group>
          <Group>
            <MantineSelect 
              value={i18n.language}
              onChange={(val) => val && i18n.changeLanguage(val)}
              data={[
                { value: 'fr', label: 'FR' },
                { value: 'en', label: 'EN' }
              ]}
              size="xs"
              style={{ width: 70 }}
            />
            <ActionIcon
              variant="default"
              onClick={() => toggleColorScheme()}
              size="lg"
              aria-label="Toggle color scheme"
            >
              {colorScheme === 'dark' ? '☀️' : '🌙'}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="sm">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">Navigation</Text>
          <NavLink 
            label={t('app.dashboard')} 
            active={currentView === 'dashboard'} 
            onClick={() => { window.location.hash = '/'; setError(null); }} 
            variant="light"
            color="blue"
            style={{ borderRadius: '8px' }}
          />
          <NavLink 
            label={t('app.backends')} 
            active={currentView === 'backends'} 
            onClick={() => { window.location.hash = '/backends'; setError(null); }} 
            variant="light"
            color="blue"
            style={{ borderRadius: '8px' }}
          />
          <NavLink 
            label={t('app.storages')} 
            active={currentView === 'storages'} 
            onClick={() => { window.location.hash = '/storages'; setError(null); }} 
            variant="light"
            color="blue"
            style={{ borderRadius: '8px' }}
          />
          <NavLink 
            label={t('app.auth')} 
            active={currentView === 'auth'} 
            onClick={() => { window.location.hash = '/auth'; setError(null); }} 
            variant="light"
            color="blue"
            style={{ borderRadius: '8px' }}
          />
        </Stack>

        <Stack gap="sm" mt="xl">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">Modèles ({models.length})</Text>
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '50vh' }}>
            {models.map(m => (
              <NavLink 
                key={m.uid}
                label={m.name} 
                active={currentModel?.uid === m.uid} 
                onClick={() => { window.location.hash = `/models/${m.name}`; setError(null); }} 
                variant="subtle"
                color="teal"
                style={{ borderRadius: '8px', marginBottom: '4px' }}
              />
            ))}
          </div>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        {/* Error Banner */}
        {error && (
          <div style={{ padding: '15px', backgroundColor: 'rgba(255, 0, 0, 0.1)', color: '#ff6b6b', border: '1px solid #ff6b6b', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <span><strong>Erreur : </strong> {error}</span>
            <ActionIcon variant="subtle" color="red" onClick={() => setError(null)}>✖</ActionIcon>
          </div>
        )}

        {/* Views */}
        {currentView === 'new-model' ? (
          <CreateModel onCreate={handleCreateModel} onCancel={() => window.location.hash = '/'} error={error} />
        ) : !currentModel ? (
          currentView === 'backends' ? (
            <BackendsManager backends={backends} models={models} onRefresh={loadModels} />
          ) : currentView === 'storages' ? (
            <StoragesManager />
          ) : currentView === 'auth' ? (
            <AuthManager />
          ) : (
            <Dashboard models={models} backends={backends} onNavigateToNewModel={() => window.location.hash = '/models/new'} />
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <header style={{ marginBottom: '20px' }}>
              <Title order={2}>Édition : {currentModel.name}</Title>
              <Text c="dimmed">L'état est sauvegardé en temps réel.</Text>
            </header>

            <div style={{display: 'flex', gap: '20px', flex: 1}}>
              <section style={{flex: 1}}>
                <Paper shadow="sm" radius="md" p="xl" withBorder>
                {(!selectedVersion || selectedVersion === (currentModel.version || 1)) ? (
                  <>
                    <Title order={4} mb="md">{editingPropertyId ? 'Modifier la propriété' : 'Ajouter des propriétés'}</Title>
                    <form onSubmit={handleSaveProperty} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                      <TextInput 
                        placeholder="Nom (ex: amount)" 
                        value={propName} 
                        onChange={(e) => setPropName(e.currentTarget.value)} 
                        required 
                      />
                      <SimpleGrid cols={4} spacing="xs">
                        {[
                          { value: 'StringProperty', label: 'Texte', icon: '📝' },
                          { value: 'NumberProperty', label: 'Nombre', icon: '🔢' },
                          { value: 'BooleanProperty', label: 'Booléen', icon: '☑️' },
                          { value: 'DateTimeProperty', label: 'Date', icon: '📅' },
                          { value: 'ObjectProperty', label: 'Objet', icon: '🔗' },
                          { value: 'CollectionProperty', label: 'Collection', icon: '📚' },
                          { value: 'ArrayProperty', label: 'Liste', icon: '📋' },
                          { value: 'MapProperty', label: 'Dico', icon: '🗂️' },
                          { value: 'EnumProperty', label: 'Enum', icon: '🔠' },
                          { value: 'FileProperty', label: 'Fichier', icon: '📁' },
                          { value: 'HashProperty', label: 'Secret', icon: '🔑' }
                        ].map(pt => (
                          <Card
                            key={pt.value}
                            padding="xs"
                            radius="md"
                            withBorder
                            onClick={() => setPropType(pt.value)}
                            style={{
                              backgroundColor: propType === pt.value ? 'var(--mantine-color-teal-light)' : 'transparent',
                              borderColor: propType === pt.value ? 'var(--mantine-color-teal-filled)' : 'var(--mantine-color-default-border)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <span style={{fontSize: '20px'}}>{pt.icon}</span>
                            <Text size="xs" fw={propType === pt.value ? 700 : 500} c={propType === pt.value ? 'teal' : 'dimmed'}>{pt.label}</Text>
                          </Card>
                        ))}
                      </SimpleGrid>
                      {(propType === 'ObjectProperty' || propType === 'CollectionProperty') && (
                        <MantineSelect 
                          placeholder="Modèle cible"
                          value={propOptions.instanceOf || null} 
                          onChange={(val) => setPropOptions({...propOptions, instanceOf: val})}
                          required
                          data={models.map((m: any) => ({ value: m.name, label: m.name }))}
                        />
                      )}
                      <MantineCheckbox 
                        label="Champ obligatoire"
                        checked={isMandatory} 
                        onChange={(e) => setIsMandatory(e.currentTarget.checked)} 
                        color="teal"
                      />
                      <PropertyOptionsEditor 
                        propType={propType} 
                        options={propOptions} 
                        onChange={setPropOptions} 
                        models={models} 
                        inputStyle={inputStyle} 
                      />
                      <Group grow>
                        <Button type="submit" color="teal" variant="light">
                          {editingPropertyId ? 'Sauvegarder les modifications' : '+ Ajouter la propriété'}
                        </Button>
                        {editingPropertyId && (
                          <Button type="button" color="gray" variant="subtle" onClick={cancelEditProperty}>Annuler</Button>
                        )}
                      </Group>
                    </form>
                  </>
                ) : (
                  <Center style={{ height: '200px' }}>
                    <Stack align="center">
                      <Text c="dimmed">Vous consultez une ancienne version (Lecture seule).</Text>
                      <Text c="dimmed">Pour ajouter des propriétés, retournez sur le brouillon courant ou restaurez cette version.</Text>
                    </Stack>
                  </Center>
                )}
                </Paper>
              </section>

              <section style={{flex: 1, overflowY: 'auto'}}>
                <Paper shadow="sm" radius="md" p="xl" withBorder>
                  <Title order={4} mb="md">Données du modèle</Title>
                  
                  <form onSubmit={handleUpdateModel} style={{display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px'}}>
                    <TextInput label="Nom du Modèle" value={currentModel.name} onChange={e => setCurrentModel({...currentModel, name: e.target.value})} />
                    <TextInput label="Collection (BDD)" value={currentModel.collectionName || ''} onChange={e => setCurrentModel({...currentModel, collectionName: e.target.value})} />
                    <MantineCheckbox label="Persisté en base de données" checked={currentModel.isPersisted || false} onChange={e => setCurrentModel({...currentModel, isPersisted: e.currentTarget.checked})} />
                    <Button type="submit" style={{alignSelf: 'flex-start'}}>Sauvegarder</Button>
                  </form>

                  <Group justify="space-between" mb="md">
                    <Title order={4}>Propriétés ({properties.length})</Title>
                    <Group gap="sm">
                      <Text size="sm" c="dimmed">Version :</Text>
                      <MantineSelect 
                        value={String(selectedVersion || '')} 
                        onChange={val => setSelectedVersion(parseInt(val || '1'))}
                        data={Array.from({length: currentModel.version || 1}, (_, i) => i + 1).map(v => ({
                          value: String(v), 
                          label: `v${v} ${v === (currentModel.version || 1) ? '(Brouillon)' : ''}`
                        }))}
                        style={{ width: '130px' }}
                      />
                      {selectedVersion === (currentModel.version || 1) ? (
                        <Group gap="xs">
                          <Button color="teal" size="sm" onClick={handleVersionner}>Sauvegarder la version</Button>
                          <Button color="blue" size="sm" disabled variant="outline" title="Vous ne pouvez pas déployer un brouillon.">Déployer</Button>
                        </Group>
                      ) : (
                        <Group gap="xs">
                          <Button color="orange" size="sm" onClick={handleRestaurer}>Restaurer cette version</Button>
                          <Button color="blue" size="sm" onClick={handleDeployClick} disabled={backends.length === 0} title={backends.length === 0 ? "Aucun backend configuré" : "Déployer cette version"}>Déployer</Button>
                        </Group>
                      )}
                    </Group>
                  </Group>

                  <Stack gap="sm">
                    {sortedProperties.map(p => {
                      const isReadOnly = selectedVersion !== null && selectedVersion < (currentModel.version || 1);
                      return (
                      <Card 
                        key={p.uid} 
                        draggable={!isReadOnly}
                        onDragStart={(e) => handleDragStart(e, p.uid)}
                        onDragOver={(e) => handleDragOver(e, p.uid)}
                        onDragLeave={() => setDragOverPropId(null)}
                        onDrop={(e) => handleDrop(e, p.uid)}
                        onDragEnd={() => { setDraggedPropId(null); setDragOverPropId(null); }}
                        shadow="xs"
                        padding="md"
                        radius="md"
                        withBorder
                        style={{
                          opacity: draggedPropId === p.uid ? 0.4 : (isReadOnly ? 0.7 : 1),
                          border: dragOverPropId === p.uid ? '2px dashed var(--mantine-color-teal-filled)' : undefined,
                          transition: 'all 0.2s ease',
                          cursor: isReadOnly ? 'default' : 'grab'
                        }}
                      >
                        <Group justify="space-between">
                          <Group gap="md" style={{ flex: 1 }}>
                            {!isReadOnly && <span style={{fontSize: '18px', color: 'var(--mantine-color-dimmed)', cursor: 'grab'}}>☰</span>}
                            <Text fw={700}>{p.name}</Text>
                            <Badge color="gray" variant="light">{p.propertyType}</Badge>
                            {p.mandatory && <Badge color="yellow" variant="outline">Requis</Badge>}
                          </Group>
                          {!isReadOnly && (
                            <Group gap="xs">
                              <Button variant="light" size="xs" onClick={() => handleEditProperty(p)}>Modifier</Button>
                              <ActionIcon variant="light" color="red" onClick={() => handleDeleteProperty(p.uid)} title="Supprimer">✖</ActionIcon>
                            </Group>
                          )}
                        </Group>
                        {p.options && Object.keys(p.options).length > 0 && (
                          <div style={{fontSize: '13px', color: 'var(--mantine-color-dimmed)', marginTop: '10px'}}>
                            <strong>Options: </strong>
                            {Object.entries(p.options).map(([k, v]) => {
                              let displayValue = String(v)
                              if (k === 'instanceOf') {
                                const linkedModel = models.find(m => m.uid === v)
                                if (linkedModel) displayValue = linkedModel.name
                              }
                              return (
                              <span key={k} style={{marginRight: '15px', display: 'inline-block', marginBottom: '5px'}}>
                                <code style={{backgroundColor: 'var(--mantine-color-default-hover)', padding: '2px 4px', borderRadius: '3px'}}>{k}</code>: <strong>{displayValue}</strong>
                              </span>
                              )
                            })}
                          </div>
                        )}
                      </Card>
                      );
                    })}
                  </Stack>
                </Paper>
              </section>
            </div>
          </div>
        )}
      </AppShell.Main>

      {/* Deploy Modal Overlay */}
      {isDeployModalOpen && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <Paper shadow="xl" radius="md" p="xl" withBorder style={{ width: '500px' }}>
            <Title order={3} mb="md">Déployer le modèle</Title>
            
            {backends.length === 0 ? (
              <div>
                <Text c="dimmed" mb="md">Aucun backend n'est déclaré. Vous devez configurer une base de données cible avant de pouvoir déployer.</Text>
                <Group justify="flex-end">
                  <Button variant="subtle" color="gray" onClick={() => setIsDeployModalOpen(false)}>Fermer</Button>
                  <Button color="teal" onClick={() => { setIsDeployModalOpen(false); window.location.hash = '/backends'; }}>Configurer un Backend</Button>
                </Group>
              </div>
            ) : (
              <div>
                <Text c="dimmed" mb="md">Sélectionnez le backend cible pour ce déploiement :</Text>
                
                {deployError && (
                  <div style={{ padding: '10px', backgroundColor: 'rgba(255, 0, 0, 0.1)', color: '#ff6b6b', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' }}>
                    <strong>Erreur de déploiement :</strong><br/>{deployError}
                  </div>
                )}

                <MantineSelect 
                  value={selectedBackendForDeploy} 
                  onChange={(val) => setSelectedBackendForDeploy(val || '')}
                  data={backends.map(b => ({ value: b.uid, label: `${b.name} ${b.isDefault ? '(Par défaut)' : ''}` }))}
                  mb="xl"
                />

                <Group justify="flex-end">
                  <Button variant="subtle" color="gray" onClick={() => { setIsDeployModalOpen(false); setDeployError(null); }}>Annuler</Button>
                  <Button color="blue" onClick={() => executeDeploy(selectedBackendForDeploy)}>Confirmer le déploiement</Button>
                </Group>
              </div>
            )}
          </Paper>
        </div>
      )}

      <AppShell.Footer p="md">
        <Group justify="center" align="center">
          <Text size="sm" c="dimmed">
            {t('app.developedBy')}
          </Text>
          <img src={logoUrl} alt="Quatrain Logo" style={{ height: '24px' }} />
        </Group>
      </AppShell.Footer>
    </AppShell>
  )
}

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <AppContent />
    </I18nextProvider>
  )
}

const inputStyle = {
  width: '100%',
  backgroundColor: 'rgba(0,0,0,0.2)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  padding: '10px',
  color: 'var(--text-main)',
  fontFamily: 'inherit',
  fontSize: '1rem',
}

export default App
