export enum LogLevel {
   TRACE = 0,
   DEBUG = 1,
   INFO = 2,
   WARN = 3,
   ERROR = 4,
   SILENT = 5,
}

export interface LoggerType {
   log(message: string): void
   debug(message: string): void
   warn(message: string): void
   info(message: string): void
   error(message: string): void
   trace(message: string): void
}

export const loglevelNames = [
   'TRACE',
   'DEBUG',
   'INFO',
   'WARN',
   'ERROR',
   'SILENT',
]

export abstract class AbstractLoggerAdapter implements LoggerType {
   protected _me: string = ''
   protected _logLevel: LogLevel = LogLevel.WARN
   protected _logger: any = undefined

   constructor(prefix = '', _level: LogLevel = LogLevel.WARN) {
      this._me = prefix
   }

   logLevel(level: LogLevel) {
      this._logLevel = level
   }

   /**
    * Renvoie un clone de l'adaptateur avec un préfixe concatené
    * Ex: new Logger("Queue").clone("MyQueue") => Logger("Queue][MyQueue") -> qui s'affichera [Queue][MyQueue]
    */
   clone(suffix: string): this {
      const newPrefix = this._me ? `${this._me}][${suffix}` : suffix
      return new (this.constructor as any)(newPrefix, this._logLevel)
   }

   formatLogMessage = (
      messages: any[],
      _loglevel: LogLevel = LogLevel.INFO,
      tag: string = ''
   ): string => {
      // Flatten nested arrays (from rest parameter spreading)
      const flatMessages = messages.flat()

      const prefix = `${new Date().toISOString()}${tag} - [${this._me}]`
      const strs = flatMessages.map((message: any) => {
         if (message instanceof Error) {
            return message.stack || message.message
         }
         if (typeof message === 'object' && message !== null) {
            return JSON.stringify(message)
         }
         return String(message)
      })

      return `${prefix} ${strs.join(' ')}`
   }

   /**
    * Log message using defined logger
    * @param message string | object
    * @param level string
    */
   log(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   debug(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   warn(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   info(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   error(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   trace(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }
}
