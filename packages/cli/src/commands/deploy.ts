import inquirer from 'inquirer'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomInt, randomBytes } from 'node:crypto'

interface AppMetadata {
   appName: string
   namespace: string
   env: 'dev' | 'prod'
   domain: string
   imageRef: string
   authUser: string
   authPass: string
   resources: {
      cpuRequests: string
      cpuLimits: string
      memRequests: string
      memLimits: string
      dataPvcSize: string
      storagePvcSize: string
   }
   createdAt: string
   updatedAt?: string
}

/**
 * Discovers the absolute path to the CoreDeploy repository.
 */
function discoverCoreDeployPath(): string {
   const cwd = process.cwd()

   // 1. Check if we are inside CoreDeploy already
   if (fs.existsSync(path.join(cwd, 'k8s/templates/namespace.yaml'))) {
      return cwd
   }

   // 2. Check sibling directories
   const siblingCandidates = [
      path.resolve(cwd, '../CoreDeploy'),
      path.resolve(cwd, '../../CoreDeploy'),
      path.resolve(cwd, 'CoreDeploy'),
      '/Users/crapougnax/CODE/QUATRAIN/CoreDeploy'
   ]

   for (const candidate of siblingCandidates) {
      if (fs.existsSync(path.join(candidate, 'k8s/templates/namespace.yaml'))) {
         return candidate
      }
   }

   return ''
}

/**
 * Generates a high-entropy 24-character password.
 */
function generateSecurePassword(): string {
   const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#%^*()-_=+[]{}'
   let pass = ''
   for (let i = 0; i < 24; i++) {
      const idx = randomInt(chars.length)
      pass += chars[idx]
   }
   return pass
}

/**
 * Attempts to deduce the latest stable studio-image tag from CoreApps workspace.
 */
function detectLatestStableTag(coreDeployPath: string): string {
   const fallback = '1.1.49'
   try {
      const parentDir = path.resolve(coreDeployPath, '..')
      const packageJsonPath = path.resolve(parentDir, 'CoreApps/containers/studio-image/package.json')
      if (!packageJsonPath.startsWith(parentDir)) {
         throw new Error('Path traversal detected')
      }
      if (fs.existsSync(packageJsonPath)) {
         const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
         if (content && content.version) {
            return content.version
         }
      }
   } catch {
      // Ignore and use fallback
   }
   return fallback
}

/**
 * Parses existing YAML files to reconstruct metadata if metadata.json is missing.
 */
function parseMetadataFromYaml(appDir: string, namespaceName: string): AppMetadata | null {
   try {
      const resolvedAppDir = path.resolve(appDir)
      const nsPath = path.resolve(resolvedAppDir, 'namespace.yaml')
      const ingPath = path.resolve(resolvedAppDir, 'ingressroute.yaml')
      const depPath = path.resolve(resolvedAppDir, 'deployment.yaml')
      const secPath = path.resolve(resolvedAppDir, 'secret.yaml')
      const pvcPath = path.resolve(resolvedAppDir, 'pvc.yaml')

      if (
         !nsPath.startsWith(resolvedAppDir) ||
         !ingPath.startsWith(resolvedAppDir) ||
         !depPath.startsWith(resolvedAppDir) ||
         !secPath.startsWith(resolvedAppDir) ||
         !pvcPath.startsWith(resolvedAppDir)
      ) {
         throw new Error('Path traversal detected')
      }

      if (!fs.existsSync(nsPath) || !fs.existsSync(ingPath) || !fs.existsSync(depPath) || !fs.existsSync(secPath)) {
         return null
      }

      const nsContent = fs.readFileSync(nsPath, 'utf8')
      const ingContent = fs.readFileSync(ingPath, 'utf8')
      const depContent = fs.readFileSync(depPath, 'utf8')
      const secContent = fs.readFileSync(secPath, 'utf8')

      // Deducing env and appName
      const env: 'dev' | 'prod' = namespaceName.endsWith('-dev') ? 'dev' : 'prod'
      
      // Extract appName from namespace.yaml labels: app.kubernetes.io/instance: name
      let appName = namespaceName.replace(/-[a-z0-9]{5}(-dev)?$/, '')
      const instanceMatch = nsContent.match(/app\.kubernetes\.io\/instance:\s*([^\s\n]+)/)
      if (instanceMatch) {
         appName = instanceMatch[1]
      }

      // Extract domain from ingressroute.yaml Host(`domain`)
      let domain = ''
      const hostMatch = ingContent.match(/Host\(`([^`]+)`\)/)
      if (hostMatch) {
         domain = hostMatch[1]
      }

      // Extract image reference
      let imageRef = ''
      const imageMatch = depContent.match(/image:\s*(ghcr\.io\/quatrain\/studio-image:[^\s\n]+)/)
      if (imageMatch) {
         imageRef = imageMatch[1]
      } else {
         const generalImageMatch = depContent.match(/image:\s*([^\s\n]+)/)
         if (generalImageMatch) {
            imageRef = generalImageMatch[1]
         }
      }

      // Extract Auth User/Pass from secret
      let authUser = 'admin'
      let authPass = ''
      const userMatch = secContent.match(/STUDIO_AUTH_USER:\s*([^\s\n]+)/)
      const passMatch = secContent.match(/STUDIO_AUTH_PASS:\s*([^\s\n]+)/)
      if (userMatch) {
         authUser = Buffer.from(userMatch[1].trim(), 'base64').toString('utf8')
      }
      if (passMatch) {
         authPass = Buffer.from(passMatch[1].trim(), 'base64').toString('utf8')
      }

      // Extract resources
      let cpuRequests = '100m'
      let cpuLimits = '500m'
      let memRequests = '256Mi'
      let memLimits = '512Mi'

      // We focus on the core-studio container resources
      const containerSplit = depContent.split('containers:')
      if (containerSplit.length > 1) {
         const resourcesPart = containerSplit[1]
         const reqCpuMatch = resourcesPart.match(/requests:[\s\S]*?cpu:\s*"?([^\s\n"]+)"?/)
         const reqMemMatch = resourcesPart.match(/requests:[\s\S]*?memory:\s*"?([^\s\n"]+)"?/)
         const limCpuMatch = resourcesPart.match(/limits:[\s\S]*?cpu:\s*"?([^\s\n"]+)"?/)
         const limMemMatch = resourcesPart.match(/limits:[\s\S]*?memory:\s*"?([^\s\n"]+)"?/)

         if (reqCpuMatch) cpuRequests = reqCpuMatch[1]
         if (reqMemMatch) memRequests = reqMemMatch[1]
         if (limCpuMatch) cpuLimits = limCpuMatch[1]
         if (limMemMatch) memLimits = limMemMatch[1]
      }

      // Extract PVC sizes
      let dataPvcSize = '1Gi'
      let storagePvcSize = '10Gi'
      if (fs.existsSync(pvcPath)) {
         const pvcContent = fs.readFileSync(pvcPath, 'utf8')
         // We split by standard YAML document separator
         const docs = pvcContent.split('---')
         docs.forEach(doc => {
            const nameMatch = doc.match(/name:\s*([^\s\n]+)/)
            const storageMatch = doc.match(/storage:\s*([^\s\n]+)/)
            if (nameMatch && storageMatch) {
               if (nameMatch[1].includes('data-pvc')) {
                  dataPvcSize = storageMatch[1]
               } else if (nameMatch[1].includes('storage-pvc')) {
                  storagePvcSize = storageMatch[1]
               }
            }
         })
      }

      const meta: AppMetadata = {
         appName,
         namespace: namespaceName,
         env,
         domain,
         imageRef,
         authUser,
         authPass,
         resources: {
            cpuRequests,
            cpuLimits,
            memRequests,
            memLimits,
            dataPvcSize,
            storagePvcSize
         },
         createdAt: new Date().toISOString()
      }

      // Write the file so we don't have to parse it next time
      const metaPath = path.resolve(resolvedAppDir, 'metadata.json')
      if (!metaPath.startsWith(resolvedAppDir)) {
         throw new Error('Path traversal detected')
      }
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 3), 'utf8')
      return meta
   } catch (err) {
      console.error(`Failed to parse YAML configuration for ${namespaceName}:`, err)
      return null
   }
}

/**
 * Loads all app metadata from the CoreDeploy k8s/apps directory.
 */
function loadAllDeployments(coreDeployPath: string): AppMetadata[] {
   const resolvedCoreDeploy = path.resolve(coreDeployPath)
   const appsDir = path.resolve(resolvedCoreDeploy, 'k8s/apps')
   if (!appsDir.startsWith(resolvedCoreDeploy)) {
      throw new Error('Path traversal detected')
   }
   if (!fs.existsSync(appsDir)) {
      return []
   }

   const directories = fs.readdirSync(appsDir).filter(name => {
      const itemPath = path.resolve(appsDir, name)
      if (!itemPath.startsWith(appsDir)) {
         throw new Error('Path traversal detected')
      }
      return fs.statSync(itemPath).isDirectory()
   })

   const deployments: AppMetadata[] = []
   for (const dir of directories) {
      const appDir = path.resolve(appsDir, dir)
      if (!appDir.startsWith(appsDir)) {
         throw new Error('Path traversal detected')
      }
      const metaPath = path.resolve(appDir, 'metadata.json')
      if (!metaPath.startsWith(appDir)) {
         throw new Error('Path traversal detected')
      }

      if (fs.existsSync(metaPath)) {
         try {
            const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
            deployments.push(data)
         } catch {
            // Attempt fallback parsing from YAML
            const meta = parseMetadataFromYaml(appDir, dir)
            if (meta) deployments.push(meta)
         }
      } else {
         // Attempt fallback parsing from YAML
         const meta = parseMetadataFromYaml(appDir, dir)
         if (meta) deployments.push(meta)
      }
   }

   return deployments
}

/**
 * Scaffolds manifest files from templates with variable substitution.
 */
function scaffoldManifests(
   coreDeployPath: string,
   meta: AppMetadata
) {
   const resolvedCoreDeploy = path.resolve(coreDeployPath)
   const templatesDir = path.resolve(resolvedCoreDeploy, 'k8s/templates')
   const targetDir = path.resolve(resolvedCoreDeploy, 'k8s/apps', meta.namespace)

   if (!templatesDir.startsWith(resolvedCoreDeploy) || !targetDir.startsWith(resolvedCoreDeploy)) {
      throw new Error('Path traversal detected')
   }

   if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
   }

   const templates = [
      'namespace.yaml',
      'pvc.yaml',
      'configmap.yaml',
      'secret.yaml',
      'deployment.yaml',
      'service.yaml',
      'ingressroute.yaml'
   ]

   const authUserB64 = Buffer.from(meta.authUser).toString('base64')
   const authPassB64 = Buffer.from(meta.authPass).toString('base64')

   for (const file of templates) {
      const srcFile = path.resolve(templatesDir, file)
      const destFile = path.resolve(targetDir, file)

      if (!srcFile.startsWith(templatesDir) || !destFile.startsWith(targetDir)) {
         throw new Error('Path traversal detected')
      }

      if (!fs.existsSync(srcFile)) {
         throw new Error(`Template missing: ${srcFile}`)
      }

      let content = fs.readFileSync(srcFile, 'utf8')

      // Replace placeholders
      content = content.replace(/{{NAMESPACE}}/g, meta.namespace)
      content = content.replace(/{{APP_NAME}}/g, meta.appName)
      content = content.replace(/{{IMAGE_REF}}/g, meta.imageRef)
      content = content.replace(/{{AUTH_USER_B64}}/g, authUserB64)
      content = content.replace(/{{AUTH_PASS_B64}}/g, authPassB64)
      content = content.replace(/{{DOMAIN}}/g, meta.domain)
      content = content.replace(/{{CPU_REQUESTS}}/g, meta.resources.cpuRequests)
      content = content.replace(/{{CPU_LIMITS}}/g, meta.resources.cpuLimits)
      content = content.replace(/{{MEM_REQUESTS}}/g, meta.resources.memRequests)
      content = content.replace(/{{MEM_LIMITS}}/g, meta.resources.memLimits)
      content = content.replace(/{{DATA_PVC_SIZE}}/g, meta.resources.dataPvcSize)
      content = content.replace(/{{STORAGE_PVC_SIZE}}/g, meta.resources.storagePvcSize)

      fs.writeFileSync(destFile, content, 'utf8')
   }

   // Write metadata.json
   const metaPath = path.resolve(targetDir, 'metadata.json')
   if (!metaPath.startsWith(targetDir)) {
      throw new Error('Path traversal detected')
   }
   fs.writeFileSync(metaPath, JSON.stringify(meta, null, 3), 'utf8')
}

/**
 * Applies the scaffolding manifests in the correct order to ensure the namespace exists first
 * and non-k8s files (like metadata.json) are ignored.
 */
function applyManifests(coreDeployPath: string, namespace: string): string {
   const targetDir = path.join(coreDeployPath, 'k8s/apps', namespace)
   const manifestFiles = [
      'namespace.yaml',
      'pvc.yaml',
      'configmap.yaml',
      'secret.yaml',
      'deployment.yaml',
      'service.yaml',
      'ingressroute.yaml'
   ]
   const args = ['apply']
   for (const f of manifestFiles) {
      args.push('-f', path.join(targetDir, f))
   }
   const safeEnv = {
      ...process.env,
      PATH: '/usr/bin:/usr/local/bin:/usr/sbin:/sbin:/opt/homebrew/bin'
   }
   const result = spawnSync('kubectl', args, { encoding: 'utf8', shell: false, env: safeEnv })
   if (result.error) throw result.error
   if (result.status !== 0) {
      throw new Error(result.stderr || `Command failed: kubectl ${args.join(' ')}`)
   }
   return result.stdout
}

/**
 * Command Entrypoint for `core deploy`
 */
export async function deployCommand() {
   console.log('\n==============================================')
   console.log('   Quatrain Core Studio - Deployment Manager  ')
   console.log('==============================================\n')

   // 1. Auto-discover CoreDeploy Repository Path
   let coreDeployPath = discoverCoreDeployPath()
   if (coreDeployPath) {
      console.log(`📡 Auto-detected CoreDeploy at: \x1b[33m${coreDeployPath}\x1b[0m`)
   } else {
      console.log('⚠️ Could not auto-detect the CoreDeploy repository directory.')
      const pathAnswer = await inquirer.prompt([
         {
            type: 'input',
            name: 'path',
            message: 'Please provide the absolute path to CoreDeploy:',
            validate: (input) => {
               if (!input || !fs.existsSync(path.join(input, 'k8s/templates/namespace.yaml'))) {
                  return 'Invalid directory. Ensure it is the root of CoreDeploy containing k8s/templates/namespace.yaml.'
               }
               return true
            }
         }
      ])
      coreDeployPath = path.resolve(pathAnswer.path)
   }

   const normalizedDeployPath = path.normalize(coreDeployPath)
   if (
      normalizedDeployPath.startsWith('/etc') ||
      normalizedDeployPath.startsWith('/var') ||
      normalizedDeployPath.startsWith('/System') ||
      normalizedDeployPath.startsWith('/bin') ||
      normalizedDeployPath.startsWith('/sbin') ||
      normalizedDeployPath.startsWith('/usr')
   ) {
      console.error('Error: Invalid deployment path destination.')
      process.exit(1)
   }

   // Main loop
   let exitCli = false
   while (!exitCli) {
      const { action } = await inquirer.prompt([
         {
            type: 'list',
            name: 'action',
            message: 'What deployment action would you like to perform?',
            choices: [
               { name: '📋 List deployments', value: 'list' },
               { name: '✨ Create new deployment', value: 'create' },
               { name: '⚙️  Modify existing deployment', value: 'modify' },
               { name: '🚀 Promote deployment (Dev -> Prod)', value: 'promote' },
               { name: '❌ Delete deployment', value: 'delete' },
               { name: '🚪 Exit', value: 'exit' }
            ]
         }
      ])

      try {
         switch (action) {
            case 'list': {
               const deployments = loadAllDeployments(coreDeployPath)
               if (deployments.length === 0) {
                  console.log('\nℹ️  No deployments found.\n')
                  break
               }

               console.log('\nActive Studio Deployments:')
               console.log('------------------------------------------------------------------------------------------------------------------------')
               console.log(
                  `${'App Name'.padEnd(15)} | ${'Namespace'.padEnd(23)} | ${'Env'.padEnd(4)} | ${'FQDN Access Domain'.padEnd(35)} | ${'Image Reference'.padEnd(35)}`
               )
               console.log('------------------------------------------------------------------------------------------------------------------------')
               deployments.forEach(d => {
                  console.log(
                     `${d.appName.padEnd(15)} | ${d.namespace.padEnd(23)} | ${d.env.padEnd(4)} | ${d.domain.padEnd(35)} | ${d.imageRef.padEnd(35)}`
                  )
               })
               console.log('------------------------------------------------------------------------------------------------------------------------\n')
               break
            }

            case 'create': {
               const answers = await inquirer.prompt([
                  {
                     type: 'input',
                     name: 'appName',
                     message: 'Nom de l\'application (alphanumeric/dashes only):',
                     validate: (input) => {
                        if (!input || !/^[a-zA-Z0-9\-]+$/.test(input)) {
                           return 'Application name is required and can only contain letters, numbers, and dashes.'
                        }
                        return true
                     }
                  },
                  {
                     type: 'list',
                     name: 'env',
                     message: 'Environnement (dev / prod) :',
                     choices: [
                        { name: 'Development (suffixed with -dev)', value: 'dev' },
                        { name: 'Production', value: 'prod' }
                     ]
                  }
               ])

               const appNameClean = answers.appName.toLowerCase()
               const suffix = randomBytes(3).toString('hex').substring(0, 5) // 5 character alphanumeric string
               
               let defaultNamespace = `${appNameClean}-${suffix}`
               let defaultDomain = `${appNameClean}-${suffix}.quatrain.app`
               if (answers.env === 'dev') {
                  defaultNamespace += '-dev'
                  defaultDomain = `${appNameClean}-${suffix}.quatrain.dev`
               }

               const flowAnswers = await inquirer.prompt([
                  {
                     type: 'input',
                     name: 'domain',
                     message: `Subdomain Access FQDN (Par défaut: ${defaultDomain}) :`,
                     default: defaultDomain
                  },
                  {
                     type: 'input',
                     name: 'imageRef',
                     message: `Référence de l'image (Par défaut: studio-image:${detectLatestStableTag(coreDeployPath)}) :`,
                     default: `ghcr.io/quatrain/studio-image:${detectLatestStableTag(coreDeployPath)}`
                  },
                  {
                     type: 'input',
                     name: 'authUser',
                     message: 'Auth Username (Par défaut: admin) :',
                     default: 'admin'
                  },
                  {
                     type: 'input',
                     name: 'authPass',
                     message: `Auth Password (Par défaut (généré sécurisé) :`,
                     default: () => generateSecurePassword()
                  },
                  {
                     type: 'list',
                     name: 'resourceChoice',
                     message: 'Configure Resources / Physical Storage:',
                     choices: [
                        { name: 'Use Default Limits (CPU req: 100m, limit: 500m | Mem req: 256Mi, limit: 512Mi | Data: 1Gi, Storage: 10Gi)', value: 'default' },
                        { name: 'Customize Resources & Storage', value: 'custom' }
                     ]
                  }
               ])

               let resources = {
                  cpuRequests: '100m',
                  cpuLimits: '500m',
                  memRequests: '256Mi',
                  memLimits: '512Mi',
                  dataPvcSize: '1Gi',
                  storagePvcSize: '10Gi'
               }

               if (flowAnswers.resourceChoice === 'custom') {
                  const customRes = await inquirer.prompt([
                     {
                        type: 'input',
                        name: 'cpuRequests',
                        message: 'CPU Requests (e.g. 100m, 50m) :',
                        default: '100m'
                     },
                     {
                        type: 'input',
                        name: 'cpuLimits',
                        message: 'CPU Limits (e.g. 500m, 200m) :',
                        default: '500m'
                     },
                     {
                        type: 'input',
                        name: 'memRequests',
                        message: 'Memory Requests (e.g. 256Mi, 128Mi) :',
                        default: '256Mi'
                     },
                     {
                        type: 'input',
                        name: 'memLimits',
                        message: 'Memory Limits (e.g. 512Mi, 256Mi) :',
                        default: '512Mi'
                     },
                     {
                        type: 'input',
                        name: 'dataPvcSize',
                        message: 'Data PVC Storage Capacity (e.g. 1Gi, 2Gi) :',
                        default: '1Gi'
                     },
                     {
                        type: 'input',
                        name: 'storagePvcSize',
                        message: 'Storage PVC Storage Capacity (e.g. 10Gi, 5Gi) :',
                        default: '10Gi'
                     }
                  ])
                  resources = customRes
               }

               const meta: AppMetadata = {
                  appName: appNameClean,
                  namespace: defaultNamespace,
                  env: answers.env,
                  domain: flowAnswers.domain,
                  imageRef: flowAnswers.imageRef,
                  authUser: flowAnswers.authUser,
                  authPass: flowAnswers.authPass,
                  resources,
                  createdAt: new Date().toISOString()
               }

               scaffoldManifests(coreDeployPath, meta)

               console.log(`\n✅ Manifests and metadata successfully scaffolded under: k8s/apps/${meta.namespace}/`)
               console.log(`🌐 FQDN access URL: https://${meta.domain}`)
               console.log(`🔑 Credentials   : ${meta.authUser} / ${meta.authPass}\n`)

               const { applyNow } = await inquirer.prompt([
                  {
                     type: 'confirm',
                     name: 'applyNow',
                     message: `Do you want to deploy ${meta.namespace} immediately to the Kubernetes cluster?`,
                     default: true
                  }
               ])

               if (applyNow) {
                  const output = applyManifests(coreDeployPath, meta.namespace)
                  console.log(`\x1b[32m${output}\x1b[0m`)
               }
               break
            }

            case 'modify': {
               const deployments = loadAllDeployments(coreDeployPath)
               if (deployments.length === 0) {
                  console.log('\nℹ️  No deployments found to modify.\n')
                  break
               }

               const { targetNs } = await inquirer.prompt([
                  {
                     type: 'list',
                     name: 'targetNs',
                     message: 'Select the deployment to modify:',
                     choices: deployments.map(d => ({
                        name: `${d.namespace} (domain: ${d.domain})`,
                        value: d.namespace
                     }))
                  }
               ])

               const targetMeta = deployments.find(d => d.namespace === targetNs)!

               const updates = await inquirer.prompt([
                  {
                     type: 'input',
                     name: 'domain',
                     message: 'Subdomain Access FQDN:',
                     default: targetMeta.domain
                  },
                  {
                     type: 'input',
                     name: 'imageRef',
                     message: 'Image Reference:',
                     default: targetMeta.imageRef
                  },
                  {
                     type: 'input',
                     name: 'authUser',
                     message: 'Auth Username:',
                     default: targetMeta.authUser
                  },
                  {
                     type: 'input',
                     name: 'authPass',
                     message: 'Auth Password:',
                     default: targetMeta.authPass
                  },
                  {
                     type: 'input',
                     name: 'cpuRequests',
                     message: 'CPU Requests:',
                     default: targetMeta.resources?.cpuRequests || '100m'
                  },
                  {
                     type: 'input',
                     name: 'cpuLimits',
                     message: 'CPU Limits:',
                     default: targetMeta.resources?.cpuLimits || '500m'
                  },
                  {
                     type: 'input',
                     name: 'memRequests',
                     message: 'Memory Requests:',
                     default: targetMeta.resources?.memRequests || '256Mi'
                  },
                  {
                     type: 'input',
                     name: 'memLimits',
                     message: 'Memory Limits:',
                     default: targetMeta.resources?.memLimits || '512Mi'
                  },
                  {
                     type: 'input',
                     name: 'dataPvcSize',
                     message: 'Data PVC storage size:',
                     default: targetMeta.resources?.dataPvcSize || '1Gi'
                  },
                  {
                     type: 'input',
                     name: 'storagePvcSize',
                     message: 'Storage PVC storage size:',
                     default: targetMeta.resources?.storagePvcSize || '10Gi'
                  }
               ])

               const updatedMeta: AppMetadata = {
                  ...targetMeta,
                  domain: updates.domain,
                  imageRef: updates.imageRef,
                  authUser: updates.authUser,
                  authPass: updates.authPass,
                  resources: {
                     cpuRequests: updates.cpuRequests,
                     cpuLimits: updates.cpuLimits,
                     memRequests: updates.memRequests,
                     memLimits: updates.memLimits,
                     dataPvcSize: updates.dataPvcSize,
                     storagePvcSize: updates.storagePvcSize
                  },
                  updatedAt: new Date().toISOString()
               }

               scaffoldManifests(coreDeployPath, updatedMeta)
               console.log(`\n✅ Manifests and metadata updated for namespace ${targetNs}.`)

               const { applyNow } = await inquirer.prompt([
                  {
                     type: 'confirm',
                     name: 'applyNow',
                     message: 'Do you want to apply these updates to the cluster now?',
                     default: true
                  }
               ])

               if (applyNow) {
                  const output = applyManifests(coreDeployPath, targetNs)
                  console.log(`\x1b[32m${output}\x1b[0m`)
               }
               break
            }

            case 'promote': {
               const deployments = loadAllDeployments(coreDeployPath)
               const devDeployments = deployments.filter(d => d.env === 'dev' || d.namespace.endsWith('-dev'))

               if (devDeployments.length === 0) {
                  console.log('\nℹ️  No development deployments found to promote.\n')
                  break
               }

               const { targetNs } = await inquirer.prompt([
                  {
                     type: 'list',
                     name: 'targetNs',
                     message: 'Select the development app to promote to production:',
                     choices: devDeployments.map(d => ({
                        name: `${d.namespace} (domain: ${d.domain})`,
                        value: d.namespace
                     }))
                  }
               ])

               const devMeta = devDeployments.find(d => d.namespace === targetNs)!
               
               // Deduce prod settings: strip -dev suffix
               const prodNamespace = devMeta.namespace.replace(/-dev$/, '')
               const prodDomain = devMeta.domain.replace(/\.dev$/, '.app')

               console.log(`\nPromoting installation to production:`)
               console.log(`  Dev Namespace  : ${devMeta.namespace} -> Prod Namespace : \x1b[32m${prodNamespace}\x1b[0m`)
               console.log(`  Dev Domain     : ${devMeta.domain} -> Prod Domain    : \x1b[32m${prodDomain}\x1b[0m\n`)

               const confirmPromote = await inquirer.prompt([
                  {
                     type: 'confirm',
                     name: 'confirm',
                     message: 'Do you want to proceed with this promotion?',
                     default: true
                  }
               ])

               if (!confirmPromote.confirm) {
                  console.log('Promotion cancelled.\n')
                  break
               }

               const prodMeta: AppMetadata = {
                  appName: devMeta.appName,
                  namespace: prodNamespace,
                  env: 'prod',
                  domain: prodDomain,
                  imageRef: devMeta.imageRef,
                  authUser: devMeta.authUser,
                  authPass: devMeta.authPass,
                  resources: { ...devMeta.resources },
                  createdAt: new Date().toISOString()
               }

               scaffoldManifests(coreDeployPath, prodMeta)
               console.log(`\n✅ Production manifests scaffolded under: k8s/apps/${prodNamespace}/`)

               const { applyNow } = await inquirer.prompt([
                  {
                     type: 'confirm',
                     name: 'applyNow',
                     message: `Do you want to deploy ${prodNamespace} immediately to production?`,
                     default: true
                  }
               ])

               if (applyNow) {
                  const output = applyManifests(coreDeployPath, prodNamespace)
                  console.log(`\x1b[32m${output}\x1b[0m`)
               }
               break
            }

            case 'delete': {
               const deployments = loadAllDeployments(coreDeployPath)
               if (deployments.length === 0) {
                  console.log('\nℹ️  No deployments found to delete.\n')
                  break
               }

               const { targetNs } = await inquirer.prompt([
                  {
                     type: 'list',
                     name: 'targetNs',
                     message: 'Select the deployment to delete:',
                     choices: deployments.map(d => ({
                        name: `${d.namespace} (domain: ${d.domain})`,
                        value: d.namespace
                     }))
                  }
               ])

               const { confirmDelete } = await inquirer.prompt([
                  {
                     type: 'confirm',
                     name: 'confirmDelete',
                     message: `Are you sure you want to delete local manifests & config for ${targetNs}? (This action is irreversible!)`,
                     default: false
                  }
               ])

               if (!confirmDelete) {
                  console.log('Deletion cancelled.\n')
                  break
               }

               const { deleteK8s } = await inquirer.prompt([
                  {
                     type: 'confirm',
                     name: 'deleteK8s',
                     message: `Do you also want to delete the namespace "${targetNs}" from the active Kubernetes cluster?`,
                     default: true
                  }
               ])

               if (deleteK8s) {
                  console.log(`Executing: kubectl delete namespace ${targetNs}`)
                  try {
                     const safeEnv = {
                        ...process.env,
                        PATH: '/usr/bin:/usr/local/bin:/usr/sbin:/sbin:/opt/homebrew/bin'
                     }
                     const result = spawnSync('kubectl', ['delete', 'namespace', targetNs], { encoding: 'utf8', shell: false, env: safeEnv })
                     if (result.error) throw result.error
                     if (result.status !== 0) throw new Error(result.stderr || 'Command failed')
                     console.log(`\x1b[32m${result.stdout}\x1b[0m`)
                  } catch (err: any) {
                     console.error(`Failed to delete namespace ${targetNs} on the cluster:`, err.message)
                  }
               }

               // Remove local files
               const resolvedCoreDeploy = path.resolve(coreDeployPath)
               const appsBaseDir = path.resolve(resolvedCoreDeploy, 'k8s/apps')
               const appDir = path.resolve(appsBaseDir, targetNs)
               if (!appDir.startsWith(appsBaseDir)) {
                  throw new Error('Path traversal detected')
               }
               if (fs.existsSync(appDir)) {
                  fs.rmSync(appDir, { recursive: true, force: true })
                  console.log(`✅ Deleted local directory: k8s/apps/${targetNs}\n`)
               }
               break
            }

            case 'exit':
               exitCli = true
               break
         }
      } catch (err: any) {
         console.error(`\n❌ Error performing action: ${err.message}\n`)
      }
   }

   console.log('🚪 Exiting Deployment Manager.')
}
