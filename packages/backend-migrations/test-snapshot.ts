import { Backend } from '@quatrain/backend'
import { SQLiteAdapter } from '@quatrain/backend-sqlite'
import { MigrationManager } from './src/MigrationManager'
import * as path from 'path'
import * as fs from 'fs'

import * as os from 'os'

async function run() {
   const dbPath = path.resolve(__dirname, 'test.sqlite')
   const adapter = new SQLiteAdapter({ config: { database: dbPath }, alias: 'default' })
   Backend.addBackend(adapter, 'default', true)

   const migrationsPath = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-test-'))

   const manager = new MigrationManager(adapter, { migrationsPath })

   const properties = [
      { name: 'title', type: 'StringProperty' },
      { name: 'age', type: 'NumberProperty' }
   ]

   console.log('Generating initial schema migration...')
   const file1 = await manager.generateDiffMigration('init', [{ collection: 'user', properties }])
   console.log('Created:', file1)

   // Modify schema
   properties.push({ name: 'is_active', type: 'BooleanProperty' })
   properties.splice(0, 1) // Remove 'title'

   console.log('Generating delta migration...')
   const file2 = await manager.generateDiffMigration('delta', [{ collection: 'user', properties }])
   console.log('Created:', file2)
}

run().catch(console.error)
