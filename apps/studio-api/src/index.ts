import path from 'path'
import { Backend, InjectMetaMiddleware } from '@quatrain/backend'
import { SQLiteAdapter } from '@quatrain/backend-sqlite'
import { StudioModel, StudioProperty } from '@quatrain/studio'
import { ExpressAdapter, ListEndpoint, CrudEndpoint } from '@quatrain/api-server'
import { Api } from '@quatrain/api'

// Initialize the backend with a persistent SQLite file for the Studio state
const sqlitePath = path.resolve(process.cwd(), '../../.quatrain-studio.sqlite')
Backend.addBackend(new SQLiteAdapter({ 
   config: { database: sqlitePath },
   middlewares: [new InjectMetaMiddleware()]
}), 'default', true)

// Initialize the API Server Adapter
const server = new ExpressAdapter(undefined, { apiPrefix: '/api' })
Api.addServer(server, 'default')

// ==========================================
// MODELS ENDPOINTS
// ==========================================
server.addEndpoint(ListEndpoint(StudioModel), '/models')
server.addEndpoint(CrudEndpoint(StudioModel), '/models', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

// ==========================================
// PROPERTIES ENDPOINTS
// ==========================================
server.addEndpoint(ListEndpoint(StudioProperty), '/properties')
server.addEndpoint(CrudEndpoint(StudioProperty), '/properties', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

// ==========================================
// SERVER START
// ==========================================
const PORT = Number(process.env.PORT) || 4000
server.start(PORT, () => {
   Api.info(`🚀 Quatrain Studio API is running on http://localhost:${PORT}`)
   Api.info(`💾 State persisted in ${sqlitePath}`)
})
