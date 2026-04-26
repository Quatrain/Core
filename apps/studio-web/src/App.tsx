import { useState, useEffect } from 'react'
import { Button, TextInput, Select as MantineSelect, Checkbox as MantineCheckbox } from '@mantine/core'
import { api } from './api'

function App() {
  const [models, setModels] = useState<any[]>([])
  const [currentModel, setCurrentModel] = useState<any>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  // Forms State
  const [modelName, setModelName] = useState('')
  const [collectionName, setCollectionName] = useState('')
  
  const [propName, setPropName] = useState('')
  const [propType, setPropType] = useState<string | null>(null)
  const [isMandatory, setIsMandatory] = useState(false)

  // Load models on startup
  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const data = await api.getModels()
      setModels(data)
    } catch (e) {
      console.error(e)
    }
  }

  const loadModelDetails = async (id: string) => {
    try {
      const model = await api.getModel(id)
      setCurrentModel(model)
      const props = await api.getModelProperties(id)
      setProperties(props)
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
    } catch (e) {
      setError((e as Error).message)
      console.error(e)
    }
  }

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentModel || !propType) return
    try {
      await api.addProperty(currentModel.uid, {
        name: propName,
        propertyType: propType,
        mandatory: isMandatory
      })
      // Reload properties
      const props = await api.getModelProperties(currentModel.uid)
      setProperties(props)
      // Reset form
      setPropName('')
      setPropType(null)
      setIsMandatory(false)
    } catch (e) {
      setError((e as Error).message)
      console.error(e)
    }
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

  const handleUpdateProperty = async (propId: string, data: any) => {
    try {
      await api.updateProperty(propId, data)
      const props = await api.getModelProperties(currentModel.uid)
      setProperties(props)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleDeleteProperty = async (propId: string) => {
    if (!confirm('Supprimer cette propriété ?')) return
    try {
      await api.deleteProperty(propId)
      const props = await api.getModelProperties(currentModel.uid)
      setProperties(props)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Quatrain Studio</h2>
        <nav>
          <ul>
            <li onClick={() => { setCurrentModel(null); setError(null); }}>+ Nouveau Modèle</li>
            <li style={{marginTop: '20px', color: 'var(--text-muted)'}}>Modèles Sauvegardés :</li>
            {models.map(m => (
              <li 
                key={m.uid} 
                className={currentModel?.uid === m.uid ? 'active' : ''}
                onClick={() => { setError(null); loadModelDetails(m.uid); }}
              >
                {m.name}
              </li>
            ))}
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
          <section className="prompt-section">
            <h3>1. Initialiser le Modèle</h3>
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
        ) : (
          <div style={{display: 'flex', gap: '20px', height: '100%'}}>
            <section className="prompt-section" style={{flex: 1}}>
              <h3>2. Ajouter des propriétés</h3>
              <form onSubmit={handleAddProperty} style={{display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px'}}>
                <TextInput 
                  placeholder="Nom (ex: amount)" 
                  value={propName} 
                  onChange={(e) => setPropName(e.currentTarget.value)} 
                  required 
                  styles={{ input: inputStyle }}
                />
                <MantineSelect 
                  placeholder="Type de propriété"
                  value={propType} 
                  onChange={setPropType}
                  styles={{ input: inputStyle }}
                  required
                  data={[
                    { value: 'StringProperty', label: 'Texte (StringProperty)' },
                    { value: 'NumberProperty', label: 'Nombre (NumberProperty)' },
                    { value: 'BooleanProperty', label: 'Booléen (BooleanProperty)' },
                    { value: 'DateTimeProperty', label: 'Date/Heure (DateTimeProperty)' },
                    { value: 'ObjectProperty', label: 'Référence / Objet (ObjectProperty)' },
                    { value: 'ArrayProperty', label: 'Tableau (ArrayProperty)' },
                    { value: 'EnumProperty', label: 'Énumération (EnumProperty)' },
                    { value: 'CollectionProperty', label: 'Collection (CollectionProperty)' },
                    { value: 'FileProperty', label: 'Fichier (FileProperty)' },
                    { value: 'HashProperty', label: 'Mot de passe (HashProperty)' },
                    { value: 'MapProperty', label: 'Dictionnaire (MapProperty)' }
                  ]}
                />
                <MantineCheckbox 
                  label="Champ obligatoire"
                  checked={isMandatory} 
                  onChange={(e) => setIsMandatory(e.currentTarget.checked)} 
                  color="teal"
                />
                <Button type="submit" color="teal" variant="light">+ Ajouter la propriété</Button>
              </form>
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

              <h4 style={{color: 'white', marginBottom: '15px'}}>Propriétés ({properties.length})</h4>
              <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {properties.map(p => (
                  <div key={p.uid} style={{display: 'flex', gap: '10px', padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', alignItems: 'center'}}>
                    <input type="text" defaultValue={p.name} onBlur={e => handleUpdateProperty(p.uid, {name: e.target.value})} style={{...inputStyle, flex: 1}} />
                    <select defaultValue={p.propertyType} onChange={e => handleUpdateProperty(p.uid, {propertyType: e.target.value})} style={{...inputStyle, width: '150px'}}>
                      <option value="StringProperty">String</option>
                      <option value="NumberProperty">Number</option>
                      <option value="BooleanProperty">Boolean</option>
                      <option value="DateTimeProperty">DateTime</option>
                      <option value="ObjectProperty">Référence</option>
                      <option value="ArrayProperty">Tableau</option>
                      <option value="EnumProperty">Énumération</option>
                      <option value="CollectionProperty">Collection</option>
                      <option value="FileProperty">Fichier</option>
                      <option value="HashProperty">Mot de passe</option>
                      <option value="MapProperty">Dictionnaire</option>
                    </select>
                    <label style={{display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-main)'}}>
                      <input type="checkbox" defaultChecked={p.mandatory} onChange={e => handleUpdateProperty(p.uid, {mandatory: e.target.checked})} />
                      Requis
                    </label>
                    <button type="button" onClick={() => handleDeleteProperty(p.uid)} style={{background: 'rgba(255,0,0,0.2)', color: '#ff6b6b', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer'}} title="Supprimer">✖</button>
                  </div>
                ))}
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
