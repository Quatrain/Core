const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')

async function run() {
   try {
      const dbPath = path.resolve(process.cwd(), '.quatrain-studio.sqlite')
      const db = await open({
         filename: dbPath,
         driver: sqlite3.Database
      })
      console.log('Opened DB')
      
      const res = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='studio_environment'`)
      if (res) {
         try {
            await db.exec(`ALTER TABLE studio_environment ADD COLUMN recipe TEXT;`)
            console.log('Column recipe added!')
         } catch (e) {
            console.log('Column probably exists:', e.message)
         }
      }
      await db.close()
   } catch (e) {
      console.error(e)
   }
}
run()
