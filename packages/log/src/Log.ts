import { AbstractLoggerAdapter, LogLevel } from './AbstractLoggerAdapter'
import { DefaultLoggerAdapter } from './DefaultLoggerAdapter'

export type LoggerRegistry<T extends AbstractLoggerAdapter> = {
   [x: string]: T
}
export class Log {
   static defaultLogger = '@default'

   protected static _loggers: LoggerRegistry<any> = {}

   // How timestamp are formatted
   static timestamp() {
      return new Date().toISOString()
   }

   static addLogger(
      alias: string,
      logger: AbstractLoggerAdapter = new DefaultLoggerAdapter(),
      setDefault: boolean = false
   ) {
      this._loggers[alias] = logger
      if (setDefault) {
         this.defaultLogger = alias
      }

      return this._loggers[alias]
   }

   static getLogger<T extends AbstractLoggerAdapter>(
      alias: string = this.defaultLogger
   ): T {
      if (alias === '@default' && !this._loggers['@default']) {
         this._loggers['@default'] = new DefaultLoggerAdapter()
      }

      if (this._loggers[alias]) {
         return this._loggers[alias]
      } else {
         throw new Error(`Unknown logger alias: '${alias}'`)
      }
   }

   /**
    * Log message using defined logger
    * @param message string | object
    */
   static log(...messages: any[]): void {
      return Log.getLogger().log(...messages)
   }

   static debug(...messages: any[]): void {
      return Log.getLogger().debug(...messages)
   }

   static warn(...messages: any[]): void {
      return Log.getLogger().warn(...messages)
   }

   static info(...messages: any[]): void {
      return Log.getLogger().info(...messages)
   }

   static error(...messages: any[]): void {
      return Log.getLogger().error(...messages)
   }

   static trace(...messages: any[]): void {
      return Log.getLogger().trace(...messages)
   }
}

export { LogLevel }
