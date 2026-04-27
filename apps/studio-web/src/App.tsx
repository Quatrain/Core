import { useState, useEffect } from 'react'
import { Button, TextInput, Select as MantineSelect, Checkbox as MantineCheckbox } from '@mantine/core'
import { api } from './api'
import { PropertyOptionsEditor } from './PropertyOptionsEditor'
import { Dashboard } from './Dashboard'
import { BackendsManager } from './BackendsManager'

function App() {
  const [models, setModels] = useState<any[]>([])
  const [backends, setBackends] = useState<any[]>([])
  const [currentModel, setCurrentModel] = useState<any>(null)
  const [currentView, setCurrentView] = useState<'dashboard' | 'backends' | 'model'>('dashboard')
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
      if (hash && hash.startsWith('/models/')) {
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

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const newModel = await api.createModel(modelName, collectionName)
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
    <div className="layout">
      {/* Deploy Modal */}
      {isDeployModalOpen && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{backgroundColor: '#1a1b1e', padding: '30px', borderRadius: '12px', width: '500px', border: '1px solid var(--border-color)'}}>
            <h3 style={{color: 'white', marginTop: 0}}>Déployer le modèle</h3>
            
            {backends.length === 0 ? (
              <div>
                <p style={{color: 'var(--text-muted)'}}>Aucun backend n'est déclaré. Vous devez configurer une base de données cible avant de pouvoir déployer.</p>
                <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px'}}>
                  <Button variant="subtle" color="gray" onClick={() => setIsDeployModalOpen(false)}>Fermer</Button>
                  <Button color="teal" onClick={() => { setIsDeployModalOpen(false); window.location.hash = '/backends'; }}>Configurer un Backend</Button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{color: 'var(--text-muted)'}}>Sélectionnez le backend cible pour ce déploiement :</p>
                
                {deployError && (
                  <div style={{ padding: '10px', backgroundColor: 'rgba(255, 0, 0, 0.2)', color: '#ff6b6b', borderRadius: '8px', marginBottom: '15px', fontSize: '14px' }}>
                    <strong>Erreur de déploiement :</strong><br/>{deployError}
                  </div>
                )}

                <select 
                  value={selectedBackendForDeploy} 
                  onChange={(e) => setSelectedBackendForDeploy(e.target.value)}
                  style={{width: '100%', padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '20px'}}
                >
                  {backends.map(b => (
                    <option key={b.uid} value={b.uid}>{b.name} {b.isDefault ? '(Par défaut)' : ''}</option>
                  ))}
                </select>

                <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                  <Button variant="subtle" color="gray" onClick={() => { setIsDeployModalOpen(false); setDeployError(null); }}>Annuler</Button>
                  <Button color="blue" onClick={() => executeDeploy(selectedBackendForDeploy)}>Confirmer le déploiement</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <aside className="sidebar">
        <h2 style={{cursor: 'pointer'}} onClick={() => { window.location.hash = '/'; }}>Quatrain Studio</h2>
        <nav>
          <ul>
            <li className={currentView === 'dashboard' ? 'active' : ''} onClick={() => { window.location.hash = '/'; setError(null); }}>Tableau de bord</li>
            <li className={currentView === 'backends' ? 'active' : ''} onClick={() => { window.location.hash = '/backends'; setError(null); }}>Backends</li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <header>
          <h1>{currentModel ? `Édition : ${currentModel.name}` : 'Créer un Modèle'}</h1>
          <p>L'état est sauvegardé en temps réel.</p>
        </header>

        {error && (
          <div style={{ padding: '15px', backgroundColor: 'rgba(255, 0, 0, 0.2)', color: '#ff6b6b', border: '1px solid #ff6b6b', borderRadius: '8px', marginBottom: '20px' }}>
            <strong>Erreur : </strong> {error}
            <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}>✖</button>
          </div>
        )}

        {!currentModel ? (
          currentView === 'backends' ? (
            <BackendsManager backends={backends} models={models} onRefresh={loadModels} />
          ) : (
            <>
              <Dashboard models={models} backends={backends} />
              <section className="prompt-section" style={{marginTop: '30px', margin: '0 20px'}}>
                <h3>+ Créer un nouveau Modèle</h3>
                <form onSubmit={handleCreateModel} style={{display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px'}}>
                  <TextInput 
                    placeholder="Nom du Modèle (ex: Invoice)" 
                    value={modelName} 
                    onChange={(e) => setModelName(e.currentTarget.value)} 
                    required 
                    styles={{ input: inputStyle }}
                  />
                  <TextInput 
                    placeholder="Collection en BDD (optionnel)" 
                    value={collectionName} 
                    onChange={(e) => setCollectionName(e.currentTarget.value)} 
                    styles={{ input: inputStyle }}
                  />
                  <Button type="submit" color="teal">Créer le Brouillon</Button>
                </form>
              </section>
            </>
          )
        ) : (
          <div style={{display: 'flex', gap: '20px', height: '100%'}}>
            <section className="prompt-section" style={{flex: 1}}>
              {(!selectedVersion || selectedVersion === (currentModel.version || 1)) ? (
                <>
                  <h3>{editingPropertyId ? '2. Modifier la propriété' : '2. Ajouter des propriétés'}</h3>
              <form onSubmit={handleSaveProperty} style={{display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px'}}>
                <TextInput 
                  placeholder="Nom (ex: amount)" 
                  value={propName} 
                  onChange={(e) => setPropName(e.currentTarget.value)} 
                  required 
                  styles={{ input: inputStyle }}
                />
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '10px'}}>
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
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => setPropType(pt.value)}
                      style={{
                        padding: '10px 5px',
                        backgroundColor: propType === pt.value ? 'rgba(32, 201, 151, 0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${propType === pt.value ? 'teal' : 'transparent'}`,
                        borderRadius: '8px',
                        color: propType === pt.value ? 'teal' : 'var(--text-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{fontSize: '20px'}}>{pt.icon}</span>
                      <span style={{fontSize: '11px', textAlign: 'center', fontWeight: propType === pt.value ? 'bold' : 'normal'}}>{pt.label}</span>
                    </button>
                  ))}
                </div>
                {(propType === 'ObjectProperty' || propType === 'CollectionProperty') && (
                  <MantineSelect 
                    placeholder="Modèle cible"
                    value={propOptions.instanceOf || null} 
                    onChange={(val) => setPropOptions({...propOptions, instanceOf: val})}
                    styles={{ input: inputStyle }}
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
                <div style={{display: 'flex', gap: '10px'}}>
                  <Button type="submit" color="teal" variant="light" style={{flex: 1}}>
                    {editingPropertyId ? 'Sauvegarder les modifications' : '+ Ajouter la propriété'}
                  </Button>
                  {editingPropertyId && (
                    <Button type="button" color="gray" variant="subtle" onClick={cancelEditProperty}>Annuler</Button>
                  )}
                </div>
              </form>
                </>
              ) : (
                <div style={{padding: '20px', color: 'var(--text-muted)', textAlign: 'center'}}>
                  <p>Vous consultez une ancienne version (Lecture seule).</p>
                  <p>Pour ajouter des propriétés, retournez sur le brouillon courant ou restaurez cette version.</p>
                </div>
              )}
            </section>

            <section className="output-section" style={{flex: 1, padding: '20px', overflowY: 'auto'}}>
              <div style={{borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px'}}>
                <h3 style={{color: 'white', margin: 0}}>Données du modèle</h3>
              </div>
              
              <form onSubmit={handleUpdateModel} style={{display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px'}}>
                <div>
                  <label style={{fontSize: '12px', color: 'var(--text-muted)'}}>Nom du Modèle</label>
                  <input type="text" value={currentModel.name} onChange={e => setCurrentModel({...currentModel, name: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{fontSize: '12px', color: 'var(--text-muted)'}}>Collection (BDD)</label>
                  <input type="text" value={currentModel.collectionName || ''} onChange={e => setCurrentModel({...currentModel, collectionName: e.target.value})} style={inputStyle} />
                </div>
                <label style={{display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)'}}>
                  <input type="checkbox" checked={currentModel.isPersisted || false} onChange={e => setCurrentModel({...currentModel, isPersisted: e.target.checked})} />
                  Persisté en base de données
                </label>
                <button type="submit" style={{alignSelf: 'flex-start', padding: '8px 15px', fontSize: '13px'}}>Sauvegarder</button>
              </form>

              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                <h4 style={{color: 'white', margin: 0}}>Propriétés ({properties.length})</h4>
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                  <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>Version :</span>
                  <select 
                    value={selectedVersion || ''} 
                    onChange={e => setSelectedVersion(parseInt(e.target.value))}
                    style={{...inputStyle, width: '130px', padding: '5px'}}
                  >
                    {Array.from({length: currentModel.version || 1}, (_, i) => i + 1).map(v => (
                      <option key={v} value={v}>v{v} {v === (currentModel.version || 1) ? '(Brouillon)' : ''}</option>
                    ))}
                  </select>
                  {selectedVersion === (currentModel.version || 1) ? (
                    <div style={{display: 'flex', gap: '5px'}}>
                      <Button color="teal" size="xs" onClick={handleVersionner}>Sauvegarder la version</Button>
                      <Button color="blue" size="xs" disabled variant="outline" title="Vous ne pouvez pas déployer un brouillon.">Déployer</Button>
                    </div>
                  ) : (
                    <div style={{display: 'flex', gap: '5px'}}>
                      <Button color="orange" size="xs" onClick={handleRestaurer}>Restaurer cette version</Button>
                      <Button color="blue" size="xs" onClick={handleDeployClick} style={{opacity: backends.length === 0 ? 0.5 : 1}} title={backends.length === 0 ? "Aucun backend configuré" : "Déployer cette version"}>Déployer</Button>
                    </div>
                  )}
                </div>
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {sortedProperties.map(p => {
                  const isReadOnly = selectedVersion !== null && selectedVersion < (currentModel.version || 1);
                  return (
                  <div 
                    key={p.uid} 
                    draggable={!isReadOnly}
                    onDragStart={(e) => handleDragStart(e, p.uid)}
                    onDragOver={(e) => handleDragOver(e, p.uid)}
                    onDragLeave={() => setDragOverPropId(null)}
                    onDrop={(e) => handleDrop(e, p.uid)}
                    onDragEnd={() => { setDraggedPropId(null); setDragOverPropId(null); }}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: '10px', padding: '15px', 
                      backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', 
                      opacity: draggedPropId === p.uid ? 0.4 : (isReadOnly ? 0.7 : 1),
                      border: dragOverPropId === p.uid ? '2px dashed teal' : '2px solid transparent',
                      transition: 'all 0.2s ease',
                      cursor: isReadOnly ? 'default' : 'grab'
                    }}
                  >
                    <div style={{display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between'}}>
                      <div style={{display: 'flex', gap: '15px', alignItems: 'center', flex: 1}}>
                        {!isReadOnly && <span style={{fontSize: '18px', color: 'var(--text-muted)', cursor: 'grab'}}>☰</span>}
                        <strong style={{color: 'white', fontSize: '15px'}}>{p.name}</strong>
                        <span style={{color: 'var(--text-main)', fontSize: '14px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '4px'}}>{p.propertyType}</span>
                        {p.mandatory && <span style={{color: '#ffd43b', fontSize: '12px', fontWeight: 'bold', border: '1px solid #ffd43b', padding: '2px 6px', borderRadius: '4px'}}>Requis</span>}
                      </div>
                      {!isReadOnly && (
                        <div style={{display: 'flex', gap: '10px'}}>
                          <button type="button" onClick={() => handleEditProperty(p)} style={{background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer'}}>Modifier</button>
                          <button type="button" onClick={() => handleDeleteProperty(p.uid)} style={{background: 'rgba(255,0,0,0.2)', color: '#ff6b6b', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer'}} title="Supprimer">✖</button>
                        </div>
                      )}
                    </div>
                    {p.options && Object.keys(p.options).length > 0 && (
                      <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '5px'}}>
                        <strong>Options: </strong>
                        {Object.entries(p.options).map(([k, v]) => {
                          let displayValue = String(v)
                          if (k === 'instanceOf') {
                            const linkedModel = models.find(m => m.uid === v)
                            if (linkedModel) displayValue = linkedModel.name
                          }
                          return (
                          <span key={k} style={{marginRight: '15px', display: 'inline-block', marginBottom: '5px'}}>
                            <code style={{backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '3px'}}>{k}</code>: <strong>{displayValue}</strong>
                          </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
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
