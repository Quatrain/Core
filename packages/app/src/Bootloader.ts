import fs from 'fs'
import path from 'path'
import { Core } from '@quatrain/core'
import { Log, LogLevel } from '@quatrain/log'

// Global singletons from Quatrain
import { Backend } from '@quatrain/backend'
import { Auth } from '@quatrain/auth'
import { Queue } from '@quatrain/queue'
import { Storage } from '@quatrain/storage'
import { Messaging } from '@quatrain/messaging'

export class AppBootloader {
   /**
    * Remplace récursivement toutes les chaînes 'env(NAME)' par la variable d'environnement correspondante.
    */
   private static resolveEnv(obj: any): any {
      if (typeof obj === 'string') {
         const match = obj.match(/^env\(([^)]+)\)$/)
         if (match) {
            return process.env[match[1]] || ''
         }
         return obj
      } else if (Array.isArray(obj)) {
         return obj.map(item => this.resolveEnv(item))
      } else if (obj !== null && typeof obj === 'object') {
         const resolved: any = {}
         for (const key of Object.keys(obj)) {
            resolved[key] = this.resolveEnv(obj[key])
         }
         return resolved
      }
      return obj
   }

   /**
    * Charge la configuration JSON et initialise tous les Adapters.
    */
   public static async bootstrap(configPath: string = 'quatrain.json'): Promise<void> {
      const fullPath = path.resolve(process.cwd(), configPath)
      
      if (!fs.existsSync(fullPath)) {
         throw new Error(`[Bootloader] Configuration file not found at: ${fullPath}`)
      }

      const rawConfig = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
      const config = this.resolveEnv(rawConfig)

      Log.info(`[Bootloader] Initializing application from ${configPath}`)

      // Set global log level if provided
      if (config.logLevel) {
         const level = (LogLevel as any)[config.logLevel.toUpperCase()]
         if (level !== undefined) {
            Core.setLogLevel(level)
         }
      }

      // --- Initialize Backend ---
      if (config.backend && config.backend.package && config.backend.adapter) {
         Log.info(`[Bootloader] Loading Backend Adapter: ${config.backend.adapter}`)
         try {
            const pkg = require(config.backend.package)
            const AdapterClass = pkg[config.backend.adapter]
            Backend.addBackend(new AdapterClass({ config: config.backend.config || {} }), 'default', true)
         } catch (e: any) {
            Log.error(`[Bootloader] Failed to load backend: ${e.message}`)
         }
      }

      // --- Initialize Auth ---
      if (config.auth && config.auth.package && config.auth.adapter) {
         Log.info(`[Bootloader] Loading Auth Adapter: ${config.auth.adapter}`)
         try {
            const pkg = require(config.auth.package)
            const AdapterClass = pkg[config.auth.adapter]
            Auth.addProvider(new AdapterClass({ config: config.auth.config || {} }), 'default', true)
         } catch (e: any) {
            Log.error(`[Bootloader] Failed to load auth: ${e.message}`)
         }
      }

      // --- Initialize Queue ---
      if (config.queue && config.queue.package && config.queue.adapter) {
         Log.info(`[Bootloader] Loading Queue Adapter: ${config.queue.adapter}`)
         try {
            const pkg = require(config.queue.package)
            const AdapterClass = pkg[config.queue.adapter]
            Queue.addQueue(new AdapterClass({ config: config.queue.config || {} }), 'default', true)
         } catch (e: any) {
            Log.error(`[Bootloader] Failed to load queue: ${e.message}`)
         }
      }

      // --- Initialize Storage ---
      if (config.storage && config.storage.package && config.storage.adapter) {
         Log.info(`[Bootloader] Loading Storage Adapter: ${config.storage.adapter}`)
         try {
            const pkg = require(config.storage.package)
            const AdapterClass = pkg[config.storage.adapter]
            Storage.addStorage(new AdapterClass({ config: config.storage.config || {} }), 'default', true)
         } catch (e: any) {
            Log.error(`[Bootloader] Failed to load storage: ${e.message}`)
         }
      }

      // --- Initialize Messaging ---
      if (config.messaging && config.messaging.package && config.messaging.adapter) {
         Log.info(`[Bootloader] Loading Messaging Adapter: ${config.messaging.adapter}`)
         try {
            const pkg = require(config.messaging.package)
            const AdapterClass = pkg[config.messaging.adapter]
            Messaging.addMessager(new AdapterClass({ config: config.messaging.config || {} }), 'default', true)
         } catch (e: any) {
            Log.error(`[Bootloader] Failed to load messaging: ${e.message}`)
         }
      }

      Log.info(`[Bootloader] Bootstrap completed successfully.`)
   }
}
