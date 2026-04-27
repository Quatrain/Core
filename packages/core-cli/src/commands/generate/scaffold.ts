import fs from 'fs'
import path from 'path'

export async function generateScaffold(projectName: string) {
   const projectDir = path.resolve(process.cwd(), projectName)

   if (fs.existsSync(projectDir)) {
      console.error(`Error: The directory "${projectName}" already exists.`)
      process.exit(1)
   }

   console.log(`\n🚀 Initializing Quatrain project: ${projectName}...\n`)

   // 1. Create base directories
   const dirs = ['apps', 'data', 'config', 'packages', 'migrations']
   dirs.forEach(dir => {
      const dirPath = path.join(projectDir, dir)
      fs.mkdirSync(dirPath, { recursive: true })
      // Add a .gitkeep file for git
      fs.writeFileSync(path.join(dirPath, '.gitkeep'), '', 'utf8')
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
   
   fs.writeFileSync(
      path.join(projectDir, 'package.json'),
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

   fs.writeFileSync(
      path.join(projectDir, 'tsconfig.json'),
      JSON.stringify(tsconfigJson, null, 3),
      'utf8'
   )
   console.log(`📄 File created: tsconfig.json`)

   // 4. Final instructions
   console.log(`\n✅ Project "${projectName}" successfully scaffolded!`)
   console.log(`\nTo get started:\n  cd ${projectName}\n  yarn install\n`)
}
