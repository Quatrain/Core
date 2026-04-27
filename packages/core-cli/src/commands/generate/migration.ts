import fs from 'fs'
import path from 'path'

export async function generateMigration(name: string) {
   if (!name) {
      console.error('Error: Migration name is required.')
      process.exit(1)
   }

   // Format YYYYMMDDHHmmss
   const now = new Date()
   const timestamp = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0')

   const filename = `${timestamp}_${name}.ts`
   const migrationsDir = path.resolve(process.cwd(), 'migrations')

   if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true })
   }

   const filePath = path.join(migrationsDir, filename)

   const template = `import { Backend } from '@quatrain/backend'

export const up = async () => {
   // const db = await Backend.getBackend('default')._connect()
   // await db.exec(\`CREATE TABLE IF NOT EXISTS example (id TEXT PRIMARY KEY);\`)
}

export const down = async () => {
   // const db = await Backend.getBackend('default')._connect()
   // await db.exec(\`DROP TABLE IF EXISTS example;\`)
}
`

   fs.writeFileSync(filePath, template, 'utf8')

   console.log(`\n✅ Migration file successfully generated at: ${filePath}\n`)
}
