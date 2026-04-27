import * as fs from 'fs'
import * as path from 'path'

export class SnapshotManager {
   private snapshotPath: string

   constructor(migrationsPath: string) {
      this.snapshotPath = path.join(migrationsPath, '.quatrain-schema-snapshot.json')
   }

   /**
    * Loads the current schema snapshot.
    * Returns an empty object if no snapshot exists.
    */
   loadSnapshot(): Record<string, any[]> {
      if (!fs.existsSync(this.snapshotPath)) {
         return {}
      }
      try {
         const content = fs.readFileSync(this.snapshotPath, 'utf8')
         return JSON.parse(content)
      } catch (err) {
         console.error('Failed to load schema snapshot', err)
         return {}
      }
   }

   /**
    * Saves the schema snapshot.
    */
   saveSnapshot(snapshot: Record<string, any[]>): void {
      try {
         // Create the directory if it doesn't exist
         const dir = path.dirname(this.snapshotPath)
         if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
         }
         
         fs.writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 3))
      } catch (err) {
         console.error('Failed to save schema snapshot', err)
         throw err
      }
   }
}
