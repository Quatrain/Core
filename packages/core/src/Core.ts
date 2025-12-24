import {
   AbstractLoggerAdapter,
   DefaultLoggerAdapter,
   Log,
   LogLevel,
} from '@quatrain/log'
import { spawn } from 'child_process'
import which from 'which'

export class Core {
   static readonly me = this.name
   static readonly storage = require('node-persist')
   static readonly storagePrefix = 'core'
   static readonly classRegistry: { [key: string]: any } = {}
   static readonly logLevel = LogLevel.DEBUG
   static readonly logger: AbstractLoggerAdapter = this.addLogger()

   static addLogger(alias: string = this.name) {
      return Log.addLogger(
         '@' + alias,
         new DefaultLoggerAdapter(alias, this.logLevel),
         true
      )
   }

   static setLogLevel(level: LogLevel) {
      this.logger.logLevel(level)
   }

   // How timestamp are formatted
   static readonly timestamp = () => new Date().toISOString()

   static definition(key: string) {
      return {
         manifest: {
            type: String,
            mandatory: true,
         },
      }
   }

   static async addConfig(key: string, value: any) {
      if (!this.storage.set) {
         await this.storage.init()
      }
      await this.storage.set(`${this.storagePrefix}_${key}`, value)
   }

   static async getConfig(key: string) {
      if (!this.storage.get) {
         await this.storage.init()
      }
      return await this.storage.get(`${this.storagePrefix}_${key}`)
   }

   static addClass(name: string, obj: any) {
      Core.classRegistry[name] = obj
   }

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
            const child = spawn(command, args, { cwd })

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

   static readonly getSystemCommandPath = (command: string): Promise<string> =>
      which(command)

   static sleep(seconds: number = 1) {
      return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
   }

   static get userClass() {
      return this.getClass('User')
   }

   static set userClass(cls: any) {
      this.addClass('User', cls)
   }

   static log(...message: any): void {
      return this.logger.log(message)
   }

   static debug(...message: any): void {
      return this.logger.debug(message)
   }

   static warn(...message: any): void {
      return this.logger.warn(message)
   }

   static info(...message: any): void {
      return this.logger.info(message)
   }

   static error(...message: any): void {
      return this.logger.error(message)
   }

   static trace(...message: any): void {
      return this.logger.trace(message)
   }
}
