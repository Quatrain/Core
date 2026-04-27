import path from 'path'
import fs from 'fs'
import { Backend, InjectMetaMiddleware } from '@quatrain/backend'
import { SQLiteAdapter } from '@quatrain/backend-sqlite'
import { StudioModel, StudioProperty, StudioBackend, StudioDeployment } from '@quatrain/studio'
import { ExpressAdapter, ListEndpoint, CrudEndpoint } from '@quatrain/api-server'
import { Api } from '@quatrain/api'
import { MigrationManager } from '@quatrain/backend-migrations'

// Initialize the backend with a persistent SQLite file for the Studio state
const sqlitePath = path.resolve(process.cwd(), '../../.quatrain-studio.sqlite')
// Lancer les migrations SQLite (doit être fait dans une fonction async auto-exécutée)
;(async () => {
   try {
      const adapter = new SQLiteAdapter({ 
         config: { database: sqlitePath },
         middlewares: [new InjectMetaMiddleware()],
         softDelete: false
      })
      Backend.addBackend(adapter, 'default', true)

      const migrationManager = new MigrationManager(adapter)
      await migrationManager.executeMigrations()

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
      // BACKENDS & DEPLOYMENTS ENDPOINTS
      // ==========================================
      server.addEndpoint(ListEndpoint(StudioBackend), '/backends')
      server.addEndpoint(CrudEndpoint(StudioBackend), '/backends', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      server.addEndpoint(ListEndpoint(StudioDeployment), '/deployments')
      server.addEndpoint(CrudEndpoint(StudioDeployment), '/deployments', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      // ==========================================
      // CUSTOM STATS ENDPOINT
      // ==========================================
      server.get('/api/models/:id/stats', async (req: any, res: any) => {
         try {
            const modelId = req.params.id
            const backendId = req.query.backendId
            
            if (!backendId) return res.json({ count: 0, status: 'no_backend' })

            const backendConfig = await StudioBackend.fromBackend(backendId)
            const model = await StudioModel.fromBackend(modelId)
            
            if (!backendConfig || !model || !model.val('collectionName')) {
               return res.json({ count: 0, status: 'error' })
            }

            // Create temporary connection to client SQLite DB
            const clientDbPath = path.resolve(process.cwd(), backendConfig.val('filePath') || 'client.sqlite')
            const sqlite3 = require('sqlite3')
            const { open } = require('sqlite')

            const db = await open({
               filename: clientDbPath,
               driver: sqlite3.Database
            })

            const collectionName = model.val('collectionName').toLowerCase()
            
            // Check if table exists
            const tableExists = await db.get(
               `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
               [collectionName]
            )

            if (!tableExists) {
               await db.close()
               return res.json({ count: 0, status: 'not_deployed' })
            }

            // Count rows
            const countResult = await db.get(`SELECT COUNT(*) as count FROM ${collectionName}`)
            await db.close()

            res.json({ count: countResult.count, status: 'deployed' })
         } catch (e) {
            console.error(e)
            res.status(500).json({ error: (e as Error).message })
         }
      })

      // ==========================================
      // DEPLOY ENDPOINT
      // ==========================================
      server.post('/api/models/:id/deploy', async (req: any, res: any) => {
         try {
            const modelId = req.params.id
            const { backendId, version } = req.body
            
            if (!backendId || !version) return res.status(400).json({ error: 'backendId and version are required' })

            const backendConfig = await StudioBackend.fromBackend(backendId)
            const model = await StudioModel.fromBackend(modelId)
            
            if (!backendConfig || !model || !model.val('collectionName')) {
               return res.status(400).json({ error: 'Invalid model or backend' })
            }

            // 1. Fetch properties for this version
            const propsResult = await StudioProperty.query()
               .where('modelId', modelId)
               .where('version', version)
               .execute('dataObjects')
            const properties = propsResult.items.filter((p: any) => p.val('status') !== 'deleted')

            // 2. Check dependencies
            const missingDeps: string[] = []
            for (const prop of properties) {
               const pType = prop.val('propertyType')
               if (pType === 'ObjectProperty' || pType === 'CollectionProperty') {
                  const options = prop.val('options')
                  if (options && options.instanceOf) {
                     const depModelId = options.instanceOf
                     // Find if depModelId is deployed on this backend
                     const depDeploysResult = await StudioDeployment.query()
                        .where('modelId', depModelId)
                        .where('backendId', backendId)
                        .execute('dataObjects')
                     const depDeploys = depDeploysResult.items
                     if (!Array.isArray(depDeploys) || depDeploys.length === 0) {
                        const depModel = await StudioModel.fromBackend(depModelId)
                        missingDeps.push(depModel ? depModel.val('name') : depModelId)
                     }
                  }
               }
            }

            if (missingDeps.length > 0) {
               return res.status(422).json({ 
                  error: 'Dépendances manquantes', 
                  message: `Impossible de déployer, les modèles suivants ne sont pas déployés sur ce backend : ${missingDeps.join(', ')}` 
               })
            }

            // 3. Generate SQL
            const collection = model.val('collectionName').toLowerCase()
            let createSql = `CREATE TABLE IF NOT EXISTS ${collection} (id TEXT PRIMARY KEY`
            let alterSqls: string[] = []
            
            properties.forEach(p => {
               const pName = p.val('name').toLowerCase() // No Id suffix as requested
               let colType = 'TEXT'
               const t = p.val('propertyType')
               if (t === 'NumberProperty') colType = 'REAL'
               else if (t === 'BooleanProperty' || t === 'DateTimeProperty') colType = 'INTEGER'
               
               createSql += `, ${pName} ${colType}`
               alterSqls.push(`ALTER TABLE ${collection} ADD COLUMN ${pName} ${colType};`)
            })
            createSql += `);`

            // 4. Execute on client DB
            const clientDbPath = path.resolve(process.cwd(), backendConfig.val('filePath') || 'client.sqlite')
            const sqlite3 = require('sqlite3')
            const { open } = require('sqlite')

            // Ensure directory exists
            fs.mkdirSync(path.dirname(clientDbPath), { recursive: true })

            const db = await open({
               filename: clientDbPath,
               driver: sqlite3.Database
            })

            // Run CREATE
            await db.exec(createSql)
            // Run ALTER (ignore errors if columns exist)
            for (const alter of alterSqls) {
               try { await db.exec(alter) } catch (e) { /* ignore existing column */ }
            }
            await db.close()

            // 5. Update/Create StudioDeployment
            const existDeploysResult = await StudioDeployment.query()
               .where('modelId', modelId)
               .where('backendId', backendId)
               .execute('classInstances')
            const existDeploys = existDeploysResult.items
            if (Array.isArray(existDeploys) && existDeploys.length > 0) {
               const deploy = existDeploys[0]
               deploy.set('version', version)
               deploy.set('migrationSql', createSql)
               await (deploy as any).save()
            } else {
               const deploy = await StudioDeployment.factory()
               deploy.set('modelId', modelId)
               deploy.set('backendId', backendId)
               deploy.set('version', version)
               deploy.set('migrationSql', createSql)
               await (deploy as any).save()
            }

            res.json({ success: true, message: 'Modèle déployé avec succès' })
         } catch (e) {
            console.error(e)
            res.status(500).json({ error: (e as Error).message })
         }
      })

      // ==========================================
      // SERVER START
      // ==========================================
      const PORT = Number(process.env.PORT) || 4000
      server.start(PORT, () => {
         Api.info(`🚀 Quatrain Studio API is running on http://localhost:${PORT}`)
         Api.info(`💾 State persisted in ${sqlitePath}`)
      })
   } catch (error) {
      Api.error(`Échec du démarrage de l'API : ${error}`)
      process.exit(1)
   }
})()
