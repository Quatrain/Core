import path from 'path'
import fs from 'fs'
import { Backend, InjectMetaMiddleware } from '@quatrain/backend'
import { SQLiteAdapter } from '@quatrain/backend-sqlite'
import { returnAs, UserProperties } from '@quatrain/core'
import { StudioModel, StudioProperty, StudioBackend, StudioDeployment, StudioProject, StudioEnvironment, StudioStorage, StudioAuth, StudioSecret, StudioWidget, StudioView } from '@quatrain/studio'
import { ExpressAdapter, ListEndpoint, CrudEndpoint } from '@quatrain/api-server'
import { Api } from '@quatrain/api'
import { MigrationManager } from '@quatrain/backend-migrations'
import { AppInfra } from '@quatrain/app'

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
      // BACKENDS, STORAGES, AUTHS, SECRETS, DEPLOYMENTS ENDPOINTS
      // ==========================================
      server.addEndpoint(ListEndpoint(StudioBackend), '/backends')
      server.addEndpoint(CrudEndpoint(StudioBackend), '/backends', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      server.addEndpoint(ListEndpoint(StudioStorage), '/storages')
      server.addEndpoint(CrudEndpoint(StudioStorage), '/storages', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      server.addEndpoint(ListEndpoint(StudioAuth), '/auths')
      server.addEndpoint(CrudEndpoint(StudioAuth), '/auths', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      server.addEndpoint(ListEndpoint(StudioSecret), '/secrets')
      server.addEndpoint(CrudEndpoint(StudioSecret), '/secrets', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      server.addEndpoint(ListEndpoint(StudioDeployment), '/deployments')
      server.addEndpoint(CrudEndpoint(StudioDeployment), '/deployments', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      // ==========================================
      // PROJECTS & ENVIRONMENTS ENDPOINTS
      // ==========================================
      server.addEndpoint(ListEndpoint(StudioProject), '/projects')
      server.addEndpoint(CrudEndpoint(StudioProject), '/projects', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      server.addEndpoint(ListEndpoint(StudioEnvironment), '/environments')
      server.addEndpoint(CrudEndpoint(StudioEnvironment), '/environments', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      // ==========================================
      // UI CONFIGURATION ENDPOINTS
      // ==========================================
      server.addEndpoint(ListEndpoint(StudioWidget), '/widgets')
      server.addEndpoint(CrudEndpoint(StudioWidget), '/widgets', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      server.addEndpoint(ListEndpoint(StudioView), '/views')
      server.addEndpoint(CrudEndpoint(StudioView), '/views', { methods: ['CREATE', 'READ', 'UPDATE', 'DELETE'] })

      // ==========================================
      // CUSTOM STATS ENDPOINT
      // ==========================================
      server.get('/api/models/:id/stats', async (req: any, res: any) => {
         try {
            const modelId = req.params.id
            const backendId = req.query.backendId
            
            if (!backendId) return res.json({ count: 0, status: 'no_backend' })

            const backendConfig = await StudioBackend.fromBackend<StudioBackend>(backendId)
            const model = await StudioModel.fromBackend<StudioModel>(modelId)
            
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

            const backendConfig = await StudioBackend.fromBackend<StudioBackend>(backendId)
            const model = await StudioModel.fromBackend<StudioModel>(modelId)
            
            if (!backendConfig || !model || !model.val('collectionName')) {
               return res.status(400).json({ error: 'Invalid model or backend' })
            }

            // 1. Fetch properties for this version
            const propsResult = await StudioProperty.query()
               .where('studioModel', modelId)
               .where('version', version)
               .execute(returnAs.AS_DATAOBJECTS)
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
                        .where('studioModel', depModelId)
                        .where('studioBackend', backendId)
                        .execute(returnAs.AS_DATAOBJECTS)
                     const depDeploys = depDeploysResult.items
                     if (!Array.isArray(depDeploys) || depDeploys.length === 0) {
                        const depModel = await StudioModel.fromBackend<StudioModel>(depModelId)
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
               .where('studioModel', modelId)
               .where('studioBackend', backendId)
               .execute(returnAs.AS_INSTANCES)
            const existDeploys = existDeploysResult.items
            if (Array.isArray(existDeploys) && existDeploys.length > 0) {
               const deploy = existDeploys[0]
               deploy.set('version', version)
               deploy.set('migrationSql', createSql)
               await (deploy as any).save()
            } else {
               const deploy = await StudioDeployment.factory()
               deploy.set('studioModel', modelId)
               deploy.set('studioBackend', backendId)
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
      // DEPLOY ENVIRONMENT ENDPOINT
      // ==========================================
      server.post('/api/environments/:id/deploy', async (req: any, res: any) => {
         try {
            const envId = req.params.id
            const { recipe, authMode } = req.body
            
            if (!recipe) return res.status(400).json({ error: 'Recipe is required' })

            const environment = await StudioEnvironment.fromBackend<StudioEnvironment>(envId)
            if (!environment) return res.status(404).json({ error: 'Environment not found' })

            const backendId = environment.val('studioBackend')
            let backendConfig = null
            if (backendId) {
               const b = await StudioBackend.fromBackend<StudioBackend>(backendId)
               if (b) {
                  let config: any = {}
                  if (b.val('engine') === 'sqlite') {
                     config = { filename: b.val('filePath') }
                  } else if (b.val('engine') === 'postgres') {
                     config = {
                        host: b.val('host'),
                        port: b.val('port'),
                        username: b.val('username'),
                        password: b.val('password'),
                        database: b.val('database')
                     }
                  } else if (b.val('engine') === 'firestore') {
                     config = {
                        projectId: b.val('projectId'),
                        credentials: b.val('credentials')
                     }
                  }

                  backendConfig = {
                     package: '@quatrain/backend-sqlite', // Default package (can be made dynamic later)
                     adapter: b.val('engine') === 'postgres' ? 'PostgresAdapter' : 'SQLiteAdapter',
                     config
                  }
               }
            }

            const storageId = environment.val('studioStorage')
            let storageConfig = null
            if (storageId) {
               const s = await StudioStorage.fromBackend<StudioStorage>(storageId)
               if (s) {
                  storageConfig = {
                     package: '@quatrain/storage',
                     adapter: s.val('provider') === 's3' ? 'S3Adapter' : 'LocalAdapter',
                     config: s.val('options')
                  }
               }
            }

            // Export all versioned models (mono-project currently)
            const modelsResult = await StudioModel.query()
               .execute(returnAs.AS_INSTANCES)
               
            const models: any[] = []
            for (const m of modelsResult.items) {
               const model = m as StudioModel
               if (model.val('status') === 'deleted') continue
               
               // Exclure les modèles brouillons (version === 0 ou undefined)
               if ((model.val('version') || 0) === 0) continue
               
               const propsResult = await StudioProperty.query().where('studioModel', model.uid).execute(returnAs.AS_INSTANCES)
               const properties = propsResult.items
                  .filter(p => (p as StudioProperty).val('status') !== 'deleted')
                  .map(p => {
                     const prop = p as StudioProperty
                     const options = prop.val('options') || {}
                     
                     // Resolve instanceOf to model name instead of UID
                     if (options.instanceOf) {
                        const targetModel = modelsResult.items.find(m => (m as StudioModel).uid === options.instanceOf) as StudioModel
                        if (targetModel) {
                           options.instanceOf = targetModel.val('name')
                        }
                     }

                     return {
                        name: prop.val('name'),
                        type: prop.val('propertyType'),
                        options,
                        ui: prop.val('ui') || {}
                     }
                  })

               models.push({
                  uid: model.uid,
                  name: model.val('name'),
                  collectionName: model.val('collectionName'),
                  properties
               })
            }

            // If OAuth, ensure a User model exists and prepare admin seed
            if (authMode === 'oauth') {
               const hasUser = models.find(m => m.name.toLowerCase() === 'user')
               if (!hasUser) {
                  models.push({
                     uid: 'quatrain-builtin-user-model',
                     name: 'User',
                     collectionName: 'users',
                     properties: UserProperties.map((p: any) => ({
                        name: p.name,
                        type: p.type,
                        options: { ...p }
                     }))
                  })
               }
            }

            // Export widgets
            const widgetsResult = await StudioWidget.query().execute(returnAs.AS_INSTANCES)
            const widgets = widgetsResult.items
               .filter(w => (w as StudioWidget).val('status') !== 'deleted')
               .map(w => {
                  const widget = w as StudioWidget
                  const targetModel = modelsResult.items.find(m => (m as StudioModel).uid === widget.val('studioModel')) as StudioModel
                  return {
                     uid: widget.uid,
                     name: widget.val('name'),
                     widgetType: widget.val('widgetType'),
                     modelName: targetModel ? targetModel.val('name') : widget.val('studioModel'),
                     layout: widget.val('layout')
                  }
               })

            // Create quatrain.json content
            const quatrainConfig: Record<string, any> = {
               name: `Env-${environment.val('name')}`,
               recipe,
               authMode,
               backend: backendConfig,
               storage: storageConfig,
               front: recipe === 'crud' ? true : false,
               models,
               widgets
            }

            // Write quatrain.json to app/
            const targetDir = '../../app'
            const appDir = path.resolve(process.cwd(), targetDir)
            if (!fs.existsSync(appDir)) {
               fs.mkdirSync(appDir, { recursive: true })
            }
            quatrainConfig.path = targetDir
            fs.writeFileSync(path.resolve(appDir, 'quatrain.json'), JSON.stringify(quatrainConfig, null, 2))

            // Generate compose.yaml and start containers via AppInfra
            await AppInfra.start(quatrainConfig)

            res.json({ success: true, message: 'Environnement déployé avec succès' })
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
