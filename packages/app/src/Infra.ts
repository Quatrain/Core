import { exec } from 'child_process'
import path from 'path'
import { Log } from '@quatrain/log'
import fs from 'fs'
import { InfraBuilder } from './InfraBuilder'

export class AppInfra {
   /**
    * Démarrer l'infrastructure locale (bases de données, storages, brokers)
    * via podman-compose ou docker-compose
    * Si une configuration est fournie, génère d'abord les fichiers compose.yaml et .env dans le dossier app/
    */
   public static async start(config?: any, targetDir: string = 'app'): Promise<void> {
      let composeFile = path.resolve(process.cwd(), targetDir, 'compose.yaml')

      if (config) {
         // Générer dynamiquement les fichiers de déploiement
         const fullTargetDir = path.resolve(process.cwd(), targetDir)
         if (!fs.existsSync(fullTargetDir)) {
            fs.mkdirSync(fullTargetDir, { recursive: true })
         }

         const { compose, env } = InfraBuilder.build(config)
         
         fs.writeFileSync(composeFile, compose, 'utf8')
         fs.writeFileSync(path.resolve(fullTargetDir, '.env'), env, 'utf8')
         
         Log.info(`[Infra] Dynamically generated compose.yaml and .env in ${fullTargetDir}`)
      }

      return this.runCompose('up -d', composeFile)
   }

   /**
    * Arrêter l'infrastructure locale
    */
   public static async stop(targetDir: string = 'app'): Promise<void> {
      const composeFile = path.resolve(process.cwd(), targetDir, 'compose.yaml')
      return this.runCompose('down', composeFile)
   }

   private static getComposeCommand(): string {
      // Prioritize podman-compose if working 'modern', otherwise fallback to docker-compose
      return 'podman-compose'
   }

   private static async runCompose(action: string, composeFile: string): Promise<void> {
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
                  Log.warn(`[Infra] podman-compose not found, falling back to docker-compose...`)
                  exec(`docker-compose -f ${composeFile} ${action}`, (err2, out2, errOut2) => {
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

         // Stream output to console
         if (child.stdout) {
            child.stdout.on('data', (data) => console.log(data.toString().trim()))
         }
         if (child.stderr) {
            child.stderr.on('data', (data) => console.error(data.toString().trim()))
         }
      })
   }
}
