import fs from 'node:fs'
import path from 'node:path'

/**
 * Bootstraps a completely new, production-ready Quatrain project structure.
 * Creates monorepo configuration files (package.json, tsconfig.json) and standard directories.
 * 
 * @param projectName - The name and path of the target project directory.
 */
export async function generateScaffold(projectName: string) {
   if (projectName.includes('..') || path.isAbsolute(projectName)) {
      console.error('Error: Project name must be a relative subdirectory and cannot contain path traversal or absolute paths.')
      process.exit(1)
   }

   const projectDir = path.resolve(process.cwd(), projectName)

   if (fs.existsSync(projectDir)) {
      console.error(`Error: The directory "${projectName}" already exists.`)
      process.exit(1)
   }

   console.log(`\n🚀 Initializing Quatrain project: ${projectName}...\n`)

   // 1. Create base directories
   const dirs = ['apps', 'data', 'config', 'packages', 'migrations']
   dirs.forEach(dir => {
      const dirPath = path.resolve(projectDir, dir)
      if (!dirPath.startsWith(projectDir)) {
         throw new Error('Path traversal detected')
      }
      fs.mkdirSync(dirPath, { recursive: true })
      const keepPath = path.resolve(dirPath, '.gitkeep')
      if (!keepPath.startsWith(dirPath)) {
         throw new Error('Path traversal detected')
      }
      // Add a .gitkeep file for git
      fs.writeFileSync(keepPath, '', 'utf8')
      console.log(`📁 Directory created: ${dir}/`)
   })

   // 2. Create base package.json (Monorepo)
   const packageJson = {
      name: projectName.toLowerCase(),
      version: "1.0.0",
      private: true,
      workspaces: [
         "apps/*",
         "packages/*"
      ],
      scripts: {
         "dev": "yarn workspaces foreach -p run dev",
         "build": "yarn workspaces foreach -ptA run build"
      },
      dependencies: {
         "@quatrain/core": "^1.0.0",
         "@quatrain/app": "^1.0.0"
      }
   }
   
   const pkgJsonPath = path.resolve(projectDir, 'package.json')
   if (!pkgJsonPath.startsWith(projectDir)) {
      throw new Error('Path traversal detected')
   }
   fs.writeFileSync(
      pkgJsonPath,
      JSON.stringify(packageJson, null, 3),
      'utf8'
   )
   console.log(`📄 File created: package.json`)

   // 3. Create root tsconfig.json
   const tsconfigJson = {
      compilerOptions: {
         target: "ES2022",
         module: "NodeNext",
         moduleResolution: "NodeNext",
         lib: ["ES2022"],
         strict: true,
         esModuleInterop: true,
         skipLibCheck: true,
         forceConsistentCasingInFileNames: true,
         baseUrl: ".",
         paths: {
            "@app/*": ["apps/*/src/index.ts"],
            "@packages/*": ["packages/*/src/index.ts"]
         }
      },
      exclude: ["node_modules", "**/dist", "**/lib"]
   }

   const tsconfigJsonPath = path.resolve(projectDir, 'tsconfig.json')
   if (!tsconfigJsonPath.startsWith(projectDir)) {
      throw new Error('Path traversal detected')
   }
   fs.writeFileSync(
      tsconfigJsonPath,
      JSON.stringify(tsconfigJson, null, 3),
      'utf8'
   )
   console.log(`📄 File created: tsconfig.json`)

   // 4. Final instructions
   console.log(`\n✅ Project "${projectName}" successfully scaffolded!`)
   console.log(`\nTo get started:\n  cd ${projectName}\n  yarn install\n`)
}
