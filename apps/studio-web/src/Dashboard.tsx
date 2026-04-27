import React, { useEffect, useState } from 'react'
import { api } from './api'

export function Dashboard({ models, backends }: { models: any[], backends: any[] }) {
  const [stats, setStats] = useState<Record<string, {count: number, status: string}>>({})

  useEffect(() => {
    // If there is at least one backend, we fetch stats
    const fetchStats = async () => {
      if (backends.length === 0) return
      const defaultBackend = backends[0]
      const newStats: any = {}
      for (const m of models) {
        try {
          const res = await api.getModelStats(m.uid, defaultBackend.uid)
          if (res.data) newStats[m.uid] = res.data
        } catch (e) {
          console.error(e)
        }
      }
      setStats(newStats)
    }
    fetchStats()
  }, [models, backends])

  return (
    <div style={{ padding: '20px' }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2 style={{color: 'white', margin: 0}}>Tableau de Bord</h2>
        <span style={{color: 'var(--text-muted)'}}>
          Backend actif : {backends.length > 0 ? backends[0].name : 'Aucun backend configuré'}
        </span>
      </div>

      {models.length === 0 ? (
        <p style={{color: 'var(--text-muted)'}}>Aucun modèle créé. Créez-en un dans la barre latérale.</p>
      ) : (
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px'}}>
          {models.map(m => (
            <div key={m.uid} style={{
              backgroundColor: 'rgba(255,255,255,0.05)', 
              borderRadius: '12px', 
              padding: '20px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px',
              border: '1px solid var(--border-color)',
              position: 'relative'
            }}>
              <h3 style={{margin: 0}}>
                <a href={`#/models/${m.name}`} style={{color: 'white', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px'}}>
                  {m.name} <span style={{fontSize: '14px', color: 'teal'}}>✎</span>
                </a>
              </h3>
              <div style={{color: 'var(--text-muted)', fontSize: '13px'}}>
                Collection: <code style={{color: 'var(--text-main)'}}>{m.collectionName || m.name.toLowerCase()}</code>
              </div>
              <div style={{color: 'var(--text-muted)', fontSize: '13px'}}>
                Version courante : <strong>{m.version > 1 ? `v${m.version - 1}` : 'Aucune (Brouillon en cours)'}</strong>
              </div>
              
              <div style={{marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                {stats[m.uid] ? (
                  <>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', 
                        backgroundColor: stats[m.uid].status === 'deployed' ? '#20c997' : '#ffc078'
                      }} />
                      <span style={{fontSize: '13px', color: stats[m.uid].status === 'deployed' ? '#20c997' : '#ffc078'}}>
                        {stats[m.uid].status === 'deployed' ? 'Déployé' : 'Non déployé (table absente)'}
                      </span>
                    </div>
                    {stats[m.uid].status === 'deployed' && (
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span style={{fontSize: '13px', color: 'var(--text-muted)'}}>{stats[m.uid].count} enregistrements</span>
                        <a href={`#/data/${m.name}`} style={{fontSize: '13px', color: 'teal', textDecoration: 'none'}}>Éditer les données →</a>
                      </div>
                    )}
                  </>
                ) : (
                  <span style={{fontSize: '13px', color: 'var(--text-muted)'}}>Vérification du statut...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
