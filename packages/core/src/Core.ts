import {
   AbstractLoggerAdapter,
   DefaultLoggerAdapter,
   Log,
   LogLevel,
} from '@quatrain/log'
import persist from 'node-persist'
import { spawn } from 'node:child_process'
import which from 'which'

/**
 * Core foundation class for Quatrain architecture.
 * Manages central configuration, logger registry, storage binding, and class mapping.
 */
export class Core {
   /** Identifying namespace for this core component. */
   static readonly me = this.name
   /** Persistent key-value storage engine reference. */
   static readonly storage = persist
   /** Context prefix string for scoped storage keys. */
   static readonly storagePrefix = 'core'
   /** Dictionary holding registered active Quatrain models/components. */
   static readonly classRegistry: { [key: string]: any } = {}
   /** System-wide base log verbosity. */
   static readonly logLevel = LogLevel.DEBUG
   /** Active logger instance for the Core domain. */
   static readonly logger: AbstractLoggerAdapter = this.addLogger()

   /**
    * Injects a new logger block under a specific namespace alias.
    * 
    * @param alias - The logging context name.
    * @returns Instantiated LoggerAdapter.
    */
   static addLogger(alias: string = this.name) {
      return Log.addLogger(
         '@' + alias,
         new DefaultLoggerAdapter(alias, this.logLevel),
         true
      )
   }

   /**
    * Mutates the underlying verbosity constraints.
    * 
    * @param level - Active LogLevel filter.
    */
   static setLogLevel(level: LogLevel) {
      this.logger.logLevel(level)
   }

   // How timestamp are formatted
   /**
    * Returns an ISO string representing the current time.
    */
   static readonly timestamp = () => new Date().toISOString()

   /**
    * Deprecated: Reserved schema definition hook.
    * 
    * @param key - The property block to generate.
    * @returns Field definitions block.
    */
   static definition(key: string) {
      return {
         manifest: {
            type: String,
            mandatory: true,
         },
      }
   }

   /**
    * Stores a primitive value durably in the core storage instance.
    * 
    * @param key - Identification string.
    * @param value - Value.
    */
   static async addConfig(key: string, value: any) {
      if (!this.storage.set) {
         await this.storage.init()
      }
      await this.storage.set(`${this.storagePrefix}_${key}`, value)
   }

   /**
    * Recovers a durably persisted value from the storage layer.
    * 
    * @param key - The target identifier.
    * @returns The recovered value.
    */
   static async getConfig(key: string) {
      if (!this.storage.get) {
         await this.storage.init()
      }
      return await this.storage.get(`${this.storagePrefix}_${key}`)
   }

   /**
    * Maps a specific entity class to an active name so the factory reflection can locate it.
    * 
    * @param name - Semantic registry name.
    * @param obj - Class constructor.
    */
   static addClass(name: string, obj: any) {
      Core.classRegistry[name] = obj
   }

   /**
    * Returns an injected class constructor by its registry identifier.
    * 
    * @param name - The semantic name to resolve.
    * @returns Class definition.
    */
   static getClass(name: string) {
      return Core.classRegistry[name]
   }

   /**
    * Execute an external command in a promise
    * @see https://stackoverflow.com/questions/46289682/how-to-wait-for-child-process-spawn-execution-with-async-await
    * @see https://dzone.com/articles/understanding-execfile-spawn-exec-and-fork-in-node
    * @param string command
    * @param array args
    * @return Promise
    */
   static readonly execPromise = (
      command: string,
      args: any[] = [],
      cwd = process.cwd()
   ): Promise<any> => {
      try {
         Core.info(`Executing command ${command} in ${cwd} with arguments:`)
         args.forEach((arg) => console.log(`\t${arg}`))
         return new Promise((resolve, reject) => {
            const child = spawn(command, args, { cwd, shell: false })

            child.stdout.on('data', (data: Buffer) =>
               Core.debug(data.toString())
            )

            child.stderr.on('data', (data: Buffer) =>
               Core.debug(data.toString())
            )

            child.on('close', (code) => {
               if (code !== 0) {
                  Core.error(`Command execution failed with code: ${code}`)
                  reject(new Error(`Process failed and returned code: ${code}`))
               } else {
                  Core.info(`Command execution completed with code: ${code}`)
                  resolve(undefined)
               }
            })
         })
      } catch (err) {
         Core.error((err as Error).message)
         throw err
      }
   }

   /**
    * Utility lookup to find executable paths in the system using `which`.
    * 
    * @param command - The executable.
    * @returns The resolved system path.
    */
   static readonly getSystemCommandPath = (command: string): Promise<string> =>
      which(command)

   /**
    * Execution suspension utility blocking the event loop context.
    * 
    * @param seconds - Duration count.
    * @returns The promise to await.
    */
   static sleep(seconds: number = 1) {
      return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
   }

   static get userClass() {
      return this.getClass('User')
   }

   static set userClass(cls: any) {
      this.addClass('User', cls)
   }

   /**
    * Triggers a standard log on the core logger.
    * 
    * @param message - Content to log.
    */
   static log(...message: any): void {
      return this.logger.log(message)
   }

   /**
    * Triggers a debug log on the core logger.
    * 
    * @param message - Content to log.
    */
   static debug(...message: any): void {
      return this.logger.debug(message)
   }

   /**
    * Triggers a warning log on the core logger.
    * 
    * @param message - Content to log.
    */
   static warn(...message: any): void {
      return this.logger.warn(message)
   }

   /**
    * Triggers an info log on the core logger.
    * 
    * @param message - Content to log.
    */
   static info(...message: any): void {
      return this.logger.info(message)
   }

   /**
    * Triggers an error log on the core logger.
    * 
    * @param message - Content to log.
    */
   static error(...message: any): void {
      return this.logger.error(message)
   }

   /**
    * Triggers a trace log on the core logger.
    * 
    * @param message - Content to log.
    */
   static trace(...message: any): void {
      return this.logger.trace(message)
   }
}
