import { spawn } from 'child_process'
import { Core } from '@quatrain/core'
import path from 'path'
import { Log } from '@quatrain/log'
import fs from 'fs'
import { InfraBuilder } from './InfraBuilder'
import { CodeGenerator } from './CodeGenerator'

export class AppInfra {
   /**
    * Démarrer l'infrastructure locale (bases de données, storages, brokers)
    * via podman-compose ou docker-compose
    * Si une configuration est fournie, génère d'abord les fichiers compose.yaml et .env dans le dossier app/
    */
   public static async start(
      config: Record<string, any>,
      onProgress?: (event: { step: string; status: 'running' | 'success' | 'error'; message: string }) => void
   ): Promise<void> {
      try {
         const targetDir = config.path || './app'
         const fullTargetDir = path.resolve(process.cwd(), targetDir)
         const composeFile = path.join(fullTargetDir, 'compose.yaml')

         if (!fs.existsSync(fullTargetDir)) {
            fs.mkdirSync(fullTargetDir, { recursive: true })
         }

         // Generate Application Source Code
         onProgress?.({ step: 'code', status: 'running', message: 'Génération du code source...' })
         CodeGenerator.generate(config, targetDir)
         onProgress?.({ step: 'code', status: 'success', message: 'Code source généré' })

         // Generate Infrastructure configuration
         onProgress?.({ step: 'infra', status: 'running', message: "Configuration de l'infrastructure..." })
         const { compose, env, dockerfile } = InfraBuilder.build(config)
         
         fs.writeFileSync(composeFile, compose, 'utf8')
         fs.writeFileSync(path.resolve(fullTargetDir, '.env'), env, 'utf8')
         fs.writeFileSync(path.resolve(fullTargetDir, 'Containerfile'), dockerfile, 'utf8')
         
         Log.info(`[Infra] Dynamically generated compose.yaml and .env in ${fullTargetDir}`)
         onProgress?.({ step: 'infra', status: 'success', message: 'Infrastructure configurée' })

         onProgress?.({ step: 'compose', status: 'running', message: 'Démarrage des containers...' })
         await this.runCompose('up -d --build', composeFile, onProgress)
         onProgress?.({ step: 'compose', status: 'success', message: 'Containers démarrés' })
      } catch (e: any) {
         Log.error(`[Infra] Failed to start infrastructure: ${e.message}`)
         onProgress?.({ step: 'error', status: 'error', message: `Erreur: ${e.message}` })
         throw e
      }
   }

   /**
    * Arrêter l'infrastructure locale
    */
   public static async stop(config: Record<string, any>): Promise<void> {
      try {
         const targetDir = config.path || './app'
         const composeFile = path.resolve(process.cwd(), targetDir, 'compose.yaml')

         Log.info(`[Infra] Stopping infrastructure...`)
         await this.runCompose('down', composeFile)
      } catch (e: any) {
         Log.error(`[Infra] Failed to stop infrastructure: ${e.message}`)
      }
   }

   private static async getPodmanCommand(): Promise<string> {
      const cmd = process.env.PODMAN_BIN_PATH || 'podman'
      try {
         return await Core.getSystemCommandPath(cmd)
      } catch (e) {
         return cmd
      }
   }

   private static async getDockerCommand(): Promise<string> {
      const cmd = process.env.DOCKER_BIN_PATH || 'docker'
      try {
         return await Core.getSystemCommandPath(cmd)
      } catch (e) {
         return cmd
      }
   }

   private static async runCompose(action: string, composeFile: string, onProgress?: (event: { step: string; status: 'running' | 'success' | 'error'; message: string }) => void): Promise<void> {
      if (!fs.existsSync(composeFile)) {
         Log.error(`[Infra] Compose file not found at: ${composeFile}`)
         throw new Error(`Compose file not found: ${composeFile}`)
      }

      const args = ['compose', '-f', composeFile, ...action.split(' ')]
      const podmanCmd = await this.getPodmanCommand()
      Log.info(`[Infra] Executing: ${podmanCmd} ${args.join(' ')}`)

      return new Promise((resolve, reject) => {
         const child = spawn(podmanCmd, args, { shell: false })

         const handleChild = (proc: ReturnType<typeof spawn>, isFallback: boolean) => {
            proc.on('error', (error: any) => {
               // Fallback to docker if podman is not installed
               if (!isFallback && error.code === 'ENOENT') {
                  Log.warn(`[Infra] podman not found, falling back to docker...`)
                  this.getDockerCommand().then(dockerCmd => {
                     const fallbackChild = spawn(dockerCmd, args, { shell: false })
                     handleChild(fallbackChild, true)
                  }).catch(reject)
               } else {
                  Log.error(`[Infra] Failed to run infrastructure: ${error.message}`)
                  reject(error)
               }
            })

            proc.on('close', (code) => {
               if (code !== 0) {
                  Log.error(`[Infra] Command failed with exit code ${code}`)
                  return reject(new Error(`Command failed with exit code ${code}`))
               }
               resolve()
            })

            // Stream output to console
            if (proc.stdout) {
               proc.stdout.on('data', (data) => {
                  const text = data.toString().trim()
                  if (text) console.log(text)
               })
            }
            if (proc.stderr) {
               proc.stderr.on('data', (data) => {
                  const text = data.toString().trim()
                  if (text) console.error(text)
               })
            }
         }

         handleChild(child, false)
      })
   }
}
