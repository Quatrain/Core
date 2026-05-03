import { exec } from 'child_process'
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

   private static getComposeCommand(): string {
      // Prioritize podman compose if working 'modern', otherwise fallback to docker compose
      return 'podman compose'
   }

   private static async runCompose(action: string, composeFile: string, onProgress?: (event: { step: string; status: 'running' | 'success' | 'error'; message: string }) => void): Promise<void> {
      return new Promise((resolve, reject) => {
         if (!fs.existsSync(composeFile)) {
            Log.error(`[Infra] Compose file not found at: ${composeFile}`)
            return reject(new Error(`Compose file not found: ${composeFile}`))
         }

         const cmd = `${this.getComposeCommand()} -f ${composeFile} ${action}`
         Log.info(`[Infra] Executing: ${cmd}`)

         const child = exec(cmd, (error, stdout, stderr) => {
            if (error) {
               // Fallback to docker-compose if podman-compose is not installed
               if (error.message.includes('command not found')) {
                  Log.warn(`[Infra] podman compose not found, falling back to docker compose...`)
                  exec(`docker compose -f ${composeFile} ${action}`, (err2, out2, errOut2) => {
                     if (err2) {
                        Log.error(`[Infra] Failed to run infrastructure: ${err2.message}`)
                        return reject(err2)
                     }
                     if (out2) Log.debug(`[Infra] ${out2}`)
                     if (errOut2) Log.debug(`[Infra] ${errOut2}`)
                     resolve()
                  })
                  return
               }
               Log.error(`[Infra] Failed to run infrastructure: ${error.message}`)
               return reject(error)
            }
            if (stdout) Log.debug(`[Infra] ${stdout}`)
            if (stderr) Log.debug(`[Infra] ${stderr}`)
            resolve()
         })

         // Stream output to console and emit progress events
         if (child.stdout) {
            child.stdout.on('data', (data) => {
               const text = data.toString().trim()
               console.log(text)
               // Could emit sub-steps here if desired:
               // onProgress?.({ step: 'compose', status: 'running', message: text })
            })
         }
         if (child.stderr) {
            child.stderr.on('data', (data) => {
               const text = data.toString().trim()
               console.error(text)
            })
         }
      })
   }
}
