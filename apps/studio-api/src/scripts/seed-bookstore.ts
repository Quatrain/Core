import path from 'path'
import { Backend, InjectMetaMiddleware } from '@quatrain/backend'
import { SQLiteAdapter } from '@quatrain/backend-sqlite'
import { MigrationManager } from '@quatrain/backend-migrations'
import { HistoryMiddleware } from '../middlewares/HistoryMiddleware'
import { StudioProject, StudioBackend, StudioEnvironment, StudioTarget, StudioModel, StudioProperty } from '@quatrain/studio'
import { StringProperty, ObjectProperty } from '@quatrain/core'

async function seed() {
   console.log('Seeding Book Store...')
   const sqlitePath = path.resolve(process.cwd(), 'data/quatrain-studio.sqlite')
   const adapter = new SQLiteAdapter({ 
      config: { database: sqlitePath },
      middlewares: [new InjectMetaMiddleware(), new HistoryMiddleware()],
      softDelete: false
   })
   Backend.addBackend(adapter, 'default', true)

   // 0. Run Migrations first
   const migrationManager = new MigrationManager(adapter)
   await migrationManager.executeMigrations()

   // 1. Create Project
   const project = await StudioProject.factory()
   project.set('name', 'Book Store')
   project.set('description', 'A complete book store management application')
   project.set('recipe', 'crud')
   project.set('defaultLanguage', 'en')
   await project.save()
   console.log(`Created Project: ${project.val('name')} (${project.uid})`)

   // 2. Create Backend
   const backend = await StudioBackend.factory()
   backend.set('name', 'Local SQLite')
   backend.set('engine', 'sqlite')
   backend.set('filePath', 'data.db')
   backend.set('studioProject', project.uid)
   backend.set('isDefault', true)
   await backend.save()
   console.log(`Created Backend: ${backend.val('name')} (${backend.uid})`)

   // 3. Find Docker Local Target
   let target
   try {
      target = await StudioTarget.fromBackend('default-target-docker')
   } catch (e) {
      console.log('Default target not found by ID, creating one...')
      target = await StudioTarget.factory()
      target.set('name', 'Docker Local')
      target.set('targetType', 'docker-compose')
      await target.save()
   }

   // 4. Create Environment
   const environment = await StudioEnvironment.factory()
   environment.set('name', 'Development')
   environment.set('environment', 'development')
   environment.set('studioProject', project.uid)
   environment.set('studioBackend', backend.uid)
   environment.set('studioTarget', target.uid)
   await environment.save()
   console.log(`Created Environment: ${environment.val('name')} (${environment.uid})`)

   // 5. Create Models and Properties
   // -- Author Model --
   const author = await StudioModel.factory()
   author.set('name', 'Author')
   author.set('collectionName', 'authors')
   author.set('isPersisted', true)
   author.set('studioProject', project.uid)
   await author.save()

   const aFn = await StudioProperty.factory()
   aFn.set('studioModel', author.uid)
   aFn.set('name', 'firstName')
   aFn.set('propertyType', StringProperty.TYPE)
   aFn.set('mandatory', true)
   aFn.set('order', 1)
   await aFn.save()

   const aLn = await StudioProperty.factory()
   aLn.set('studioModel', author.uid)
   aLn.set('name', 'lastName')
   aLn.set('propertyType', StringProperty.TYPE)
   aLn.set('mandatory', true)
   aLn.set('order', 2)
   await aLn.save()
   console.log(`Created Model: Author (${author.uid})`)

   // -- Editor Model --
   const editor = await StudioModel.factory()
   editor.set('name', 'Editor')
   editor.set('collectionName', 'editors')
   editor.set('isPersisted', true)
   editor.set('studioProject', project.uid)
   await editor.save()

   const eName = await StudioProperty.factory()
   eName.set('studioModel', editor.uid)
   eName.set('name', 'name')
   eName.set('propertyType', StringProperty.TYPE)
   eName.set('mandatory', true)
   eName.set('order', 1)
   await eName.save()

   const eCity = await StudioProperty.factory()
   eCity.set('studioModel', editor.uid)
   eCity.set('name', 'city')
   eCity.set('propertyType', StringProperty.TYPE)
   eCity.set('mandatory', false)
   eCity.set('order', 2)
   await eCity.save()
   console.log(`Created Model: Editor (${editor.uid})`)

   // -- Book Model --
   const book = await StudioModel.factory()
   book.set('name', 'Book')
   book.set('collectionName', 'books')
   book.set('isPersisted', true)
   book.set('studioProject', project.uid)
   await book.save()

   const bTitle = await StudioProperty.factory()
   bTitle.set('studioModel', book.uid)
   bTitle.set('name', 'title')
   bTitle.set('propertyType', StringProperty.TYPE)
   bTitle.set('mandatory', true)
   bTitle.set('order', 1)
   await bTitle.save()

   // Relation to Author
   const bAuthor = await StudioProperty.factory()
   bAuthor.set('studioModel', book.uid)
   bAuthor.set('name', 'authorAuthor')
   bAuthor.set('propertyType', ObjectProperty.TYPE)
   bAuthor.set('options', { instanceOf: author.uid })
   bAuthor.set('mandatory', true)
   bAuthor.set('order', 2)
   await bAuthor.save()

   // Relation to Editor
   const bEditor = await StudioProperty.factory()
   bEditor.set('studioModel', book.uid)
   bEditor.set('name', 'editorEditor')
   bEditor.set('propertyType', ObjectProperty.TYPE)
   bEditor.set('options', { instanceOf: editor.uid })
   bEditor.set('mandatory', true)
   bEditor.set('order', 3)
   await bEditor.save()

   console.log(`Created Model: Book (${book.uid})`)
   console.log('Seeding complete! You can now start the studio api.')
   process.exit(0)
}

seed().catch(err => {
   console.error('Seeding failed:', err)
   process.exit(1)
})
