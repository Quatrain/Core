import React, { useState } from 'react'
import { api } from './api'
import { TextInput, Button } from '@mantine/core'

export function BackendsManager({ backends, models, onRefresh }: { backends: any[], models: any[], onRefresh: () => void }) {
  const [name, setName] = useState('')
  const [filePath, setFilePath] = useState('../app/data.sqlite')
  const [isDefault, setIsDefault] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deployments, setDeployments] = useState<Record<string, any[]>>({})

  React.useEffect(() => {
    // Load deployments for each backend
    const loadDeployments = async () => {
      const deps: Record<string, any[]> = {}
      for (const b of backends) {
        try {
          deps[b.uid] = await api.getDeployments(b.uid)
        } catch (e) {
          console.error(e)
        }
      }
      setDeployments(deps)
    }
    loadDeployments()
  }, [backends])

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce backend ? Les déploiements associés seront orphelins.')) return
    try {
      await api.deleteBackend(id)
      onRefresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createBackend({
        name,
        engine: 'sqlite',
        filePath,
        isDefault
      })
      setName('')
      setFilePath('../app/data.sqlite')
      setIsDefault(false)
      onRefresh()
    } catch (err) {
      setError((err as Error).message)
    }
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

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{color: 'white', marginBottom: '20px'}}>Gestion des Backends (Bases de données)</h2>
      <p style={{color: 'var(--text-muted)'}}>
        Configurez ici les bases de données cibles pour votre application cliente. 
        Pour le moment, seul SQLite est supporté. Le studio s'y connectera pour interroger les données déployées.
      </p>

      {error && (
        <div style={{ padding: '15px', backgroundColor: 'rgba(255, 0, 0, 0.2)', color: '#ff6b6b', border: '1px solid #ff6b6b', borderRadius: '8px', marginBottom: '20px' }}>
          <strong>Erreur : </strong> {error}
        </div>
      )}

      <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '30px'}}>
        {backends.map(b => (
          <div key={b.uid} style={{
            backgroundColor: 'rgba(255,255,255,0.05)', 
            borderRadius: '12px', 
            padding: '20px',
            border: '1px solid var(--border-color)',
            position: 'relative'
          }}>
            <button onClick={() => handleDelete(b.uid)} style={{position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,0,0,0.2)', color: '#ff6b6b', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer'}} title="Supprimer">✖</button>
            <h3 style={{margin: 0, color: 'white', paddingRight: '40px'}}>
              {b.name} 
              <span style={{fontSize: '12px', color: 'teal', border: '1px solid teal', padding: '2px 6px', borderRadius: '4px', marginLeft: '10px'}}>{b.engine}</span>
              {b.isDefault && <span style={{fontSize: '12px', color: '#ffd43b', border: '1px solid #ffd43b', padding: '2px 6px', borderRadius: '4px', marginLeft: '10px'}}>Par défaut</span>}
            </h3>
            <div style={{color: 'var(--text-muted)', fontSize: '13px', marginTop: '10px'}}>
              Fichier SQLite : <code style={{color: 'var(--text-main)'}}>{b.filePath}</code>
            </div>

            {/* Déploiements */}
            <div style={{marginTop: '20px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
              <h4 style={{margin: '0 0 10px 0', color: 'white', fontSize: '14px'}}>Modèles déployés :</h4>
              {deployments[b.uid] && deployments[b.uid].length > 0 ? (
                <ul style={{margin: 0, paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '13px'}}>
                  {deployments[b.uid].map((dep: any) => {
                    const modelName = models.find(m => m.uid === dep.modelId)?.name || dep.modelId
                    return (
                      <li key={dep.uid}>Modèle <strong>{modelName}</strong> (version {dep.version})</li>
                    )
                  })}
                </ul>
              ) : (
                <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic'}}>Aucun modèle déployé sur ce backend.</p>
              )}
            </div>
          </div>
        ))}

        <div style={{
          backgroundColor: 'rgba(0,0,0,0.2)', 
          borderRadius: '12px', 
          padding: '20px',
          border: '1px dashed var(--border-color)',
          marginTop: '20px'
        }}>
          <h3 style={{margin: 0, color: 'white', marginBottom: '15px'}}>Ajouter un Backend</h3>
          <form onSubmit={handleAdd} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            <TextInput 
              placeholder="Nom du Backend (ex: Production Locale)" 
              value={name} 
              onChange={(e) => setName(e.currentTarget.value)} 
              required 
              styles={{ input: inputStyle }}
            />
            <TextInput 
              placeholder="Chemin du fichier SQLite (ex: ../app/data.sqlite)" 
              value={filePath} 
              onChange={(e) => setFilePath(e.currentTarget.value)} 
              required 
              styles={{ input: inputStyle }}
            />
            <label style={{display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', fontSize: '14px', cursor: 'pointer'}}>
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Définir comme backend par défaut
            </label>
            <Button type="submit" color="teal" style={{alignSelf: 'flex-start'}}>Ajouter</Button>
          </form>
        </div>
      </div>
    </div>
  )
}
