import * as fs from 'node:fs'
import * as path from 'node:path'
import { CodeGenerator } from './CodeGenerator'
import { Log } from '@quatrain/log'

describe('CodeGenerator', () => {
   const targetTestDir = path.resolve(__dirname, 'temp_codegen_test')

   beforeEach(() => {
      jest.spyOn(Log, 'info').mockImplementation(() => {})
      if (fs.existsSync(targetTestDir)) {
         fs.rmSync(targetTestDir, { recursive: true, force: true })
      }
   })

   afterEach(() => {
      if (fs.existsSync(targetTestDir)) {
         fs.rmSync(targetTestDir, { recursive: true, force: true })
      }
      jest.restoreAllMocks()
   })

   it('should generate a complete, valid application with isolated directories', () => {
      const mockConfig = {
         name: 'TestApp',
         authMode: 'basic',
         backend: {
            adapter: 'SQLiteAdapter'
         },
         models: [
            {
               name: 'Book',
               collectionName: 'books',
               properties: [
                  { name: 'title', type: 'StringProperty', mandatory: true, htmlType: 'text' },
                  { name: 'price', type: 'NumberProperty', mandatory: false }
               ]
            }
         ],
         widgets: [
            {
               modelName: 'Book',
               widgetType: 'form',
               layout: [
                  { type: 'field', name: 'title' },
                  { type: 'group', fields: ['price'] }
               ]
            }
         ]
      }

      CodeGenerator.generate(mockConfig, targetTestDir)

      // Assert basic configuration files exist
      expect(fs.existsSync(path.join(targetTestDir, 'package.json'))).toBe(true)
      expect(fs.existsSync(path.join(targetTestDir, 'tsconfig.json'))).toBe(true)

      // Assert server-side model and API routes exist
      expect(fs.existsSync(path.join(targetTestDir, 'src/models/Book.ts'))).toBe(true)
      expect(fs.existsSync(path.join(targetTestDir, 'src/api/BookApi.ts'))).toBe(true)
      expect(fs.existsSync(path.join(targetTestDir, 'src/index.ts'))).toBe(true)

      // Assert database migrations generated
      const migrationsDir = path.join(targetTestDir, 'data/migrations/default')
      expect(fs.existsSync(migrationsDir)).toBe(true)
      const migrationFiles = fs.readdirSync(migrationsDir)
      expect(migrationFiles.length).toBe(1)
      expect(migrationFiles[0]).toMatch(/_init\.ts$/)

      // Assert frontend codebases scaffolded correctly
      const webDir = path.join(targetTestDir, 'web')
      expect(fs.existsSync(path.join(webDir, 'package.json'))).toBe(true)
      expect(fs.existsSync(path.join(webDir, 'tsconfig.json'))).toBe(true)
      expect(fs.existsSync(path.join(webDir, 'vite.config.ts'))).toBe(true)
      expect(fs.existsSync(path.join(webDir, 'index.html'))).toBe(true)
      expect(fs.existsSync(path.join(webDir, 'src/main.tsx'))).toBe(true)
      expect(fs.existsSync(path.join(webDir, 'src/api.ts'))).toBe(true)
      expect(fs.existsSync(path.join(webDir, 'src/App.tsx'))).toBe(true)

      // Assert frontend React CRUD pages compiled
      const pagesDir = path.join(webDir, 'src/pages')
      expect(fs.existsSync(path.join(pagesDir, 'BookList.tsx'))).toBe(true)
      expect(fs.existsSync(path.join(pagesDir, 'BookForm.tsx'))).toBe(true)

      // Assert Docker integration exists
      expect(fs.existsSync(path.join(webDir, 'Dockerfile'))).toBe(true)
      expect(fs.existsSync(path.join(webDir, 'nginx.conf'))).toBe(true)

      // Let's verify layout code inside BookForm.tsx
      const formCode = fs.readFileSync(path.join(pagesDir, 'BookForm.tsx'), 'utf8')
      expect(formCode).toContain('TextInput label="title"')
      expect(formCode).toContain('TextInput label="price"')
      expect(formCode).toContain('<Group grow align="flex-start">')
   })

   it('should generate fallback CoreForm components when layout is missing', () => {
      const mockConfig = {
         name: 'FallbackApp',
         authMode: 'oauth',
         backend: {
            adapter: 'PostgresAdapter'
         },
         models: [
            {
               name: 'Customer',
               collectionName: 'customers',
               properties: [
                  { name: 'fullName', type: 'string', mandatory: true }
               ]
            }
         ],
         widgets: [] // Empty widgets list should trigger dynamic fallback
      }

      CodeGenerator.generate(mockConfig, targetTestDir)

      const formCode = fs.readFileSync(path.join(targetTestDir, 'web/src/pages/CustomerForm.tsx'), 'utf8')
      expect(formCode).toContain('CoreForm')
      expect(formCode).toContain('CustomerForm')

      const packageCode = fs.readFileSync(path.join(targetTestDir, 'package.json'), 'utf8')
      expect(packageCode).toContain('@quatrain/auth-oidc')
      expect(packageCode).toContain('@quatrain/backend-postgres')
   })
})
