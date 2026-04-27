import { Umzug } from 'umzug'
import { Backend, AbstractBackendAdapter } from '@quatrain/backend'
import { QuatrainMigrationStorage } from './QuatrainMigrationStorage'
import { SnapshotManager } from './SnapshotManager'
import { SchemaDiffer } from './SchemaDiffer'
import * as fs from 'fs'
import * as path from 'path'

export interface MigrationOptions {
   migrationsPath?: string
   backendAlias?: string
}

export class MigrationManager {
   private umzug: Umzug<AbstractBackendAdapter>
   private migrationsPath: string

   constructor(private adapter: AbstractBackendAdapter, private options: MigrationOptions = {}) {
      let alias = options.backendAlias || this.adapter.getParam('alias')

      // If no alias is defined, try to find it in Backend registry
      if (!alias) {
         const backends = (Backend as any)._backends || {}
         for (const [key, val] of Object.entries(backends)) {
            if (val === this.adapter) {
               alias = key
               break
            }
         }
      }
      alias = alias || 'default'

      this.migrationsPath = options.migrationsPath || path.join(process.cwd(), 'data', 'migrations', alias)

      if (!fs.existsSync(this.migrationsPath)) {
         fs.mkdirSync(this.migrationsPath, { recursive: true })
      }

      this.umzug = new Umzug({
         migrations: { glob: path.join(this.migrationsPath, '*.ts') },
         context: this.adapter,
         storage: new QuatrainMigrationStorage(this.adapter),
         logger: console,
      })
   }

   /**
    * Executes all pending migrations
    */
   async executeMigrations(): Promise<void> {
      await this.umzug.up()
   }

   /**
    * Reverts the last executed migration
    */
   async rollbackMigration(): Promise<void> {
      await this.umzug.down()
   }

   /**
    * Reverts all migrations
    */
   async rollbackAllMigrations(): Promise<void> {
      await this.umzug.down({ to: 0 })
   }

   /**
    * Creates a new atomic migration file.
    * If a model is provided, it generates standard CREATE TABLE statements.
    */
   async createMigration(name: string, modelOptions?: any): Promise<string> {
      const prefix = new Date().toISOString().replace(/T/, '').replace(/:/g, '').replace(/-/g, '').slice(0, 14)
      const filename = `${prefix}_${name}.ts`
      const filepath = path.join(this.migrationsPath, filename)

      let upSql = ''
      let downSql = ''

      if (modelOptions && modelOptions.collection && modelOptions.properties) {
         const generated = this.adapter.generateCreateSql(modelOptions.collection, modelOptions.properties)
         upSql = generated.upSql
         downSql = generated.downSql
      }

      const content = `import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   ${upSql ? upSql : '// Add your UP migration SQL here\n   // await adapter.rawQuery(`CREATE TABLE ...`)'}
}

export const down = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   ${downSql ? downSql : '// Add your DOWN migration SQL here\n   // await adapter.rawQuery(`DROP TABLE ...`)'}
}
`
      fs.writeFileSync(filepath, content)
      return filepath
   }

   /**
    * Compares the current schema models against the saved snapshot and generates a migration file
    * with the deltas (e.g. ALTER TABLE ADD COLUMN).
    */
   async generateDiffMigration(name: string, models: { collection: string; properties: any[] }[]): Promise<string | null> {
      const snapshotManager = new SnapshotManager(this.migrationsPath)
      const snapshot = snapshotManager.loadSnapshot()
      
      const upSqls: string[] = []
      const downSqls: string[] = []
      
      let hasChanges = false

      for (const model of models) {
         const collection = model.collection
         const newProps = model.properties
         const oldProps = snapshot[collection] || []

         if (!snapshot[collection]) {
            // New collection
            hasChanges = true
            const generated = this.adapter.generateCreateSql(collection, newProps)
            upSqls.push(generated.upSql)
            downSqls.push(generated.downSql)
         } else {
            // Existing collection, calculate diff
            const delta = SchemaDiffer.compare(oldProps, newProps)
            if (delta.added.length > 0 || delta.removed.length > 0 || delta.modified.length > 0) {
               hasChanges = true
               const generated = this.adapter.generateDeltaSql(collection, delta)
               if (generated.upSql.length > 0) upSqls.push(...generated.upSql)
               if (generated.downSql.length > 0) downSqls.push(...generated.downSql)
            }
         }

         // Update snapshot in memory
         snapshot[collection] = newProps
      }

      if (!hasChanges) {
         return null // No migration needed
      }

      const prefix = new Date().toISOString().replace(/T/, '').replace(/:/g, '').replace(/-/g, '').slice(0, 14)
      const filename = `${prefix}_${name}.ts`
      const filepath = path.join(this.migrationsPath, filename)

      const content = `import { AbstractBackendAdapter } from '@quatrain/backend'

export const up = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   ${upSqls.join('\n   ')}
}

export const down = async ({ context: adapter }: { context: AbstractBackendAdapter }) => {
   ${downSqls.join('\n   ')}
}
`
      fs.writeFileSync(filepath, content)
      
      // Save new snapshot
      snapshotManager.saveSnapshot(snapshot)

      return filepath
   }
}
