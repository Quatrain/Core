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

   constructor(prefix = '', level: LogLevel = LogLevel.WARN) {
      this._me = prefix
   }

   logLevel(level: LogLevel) {
      this._logLevel = level
   }

   formatLogMessage = (
      messages: any[],
      loglevel: LogLevel = LogLevel.INFO
   ): string => {
      const msgs = Array.isArray(messages) ? [...messages] : [messages]

      msgs.unshift(`${new Date().toISOString()} - [${this._me}]`)
      const strs = msgs.map((message: any) => {
         if (message instanceof Error) {
            return message.stack || message.message
         }
         if (typeof message === 'object' && message !== null) {
            return JSON.stringify(message)
         }
         return String(message)
      })

      return strs.join(' ')
   }

   /**
    * Log message using defined logger
    * @param message string | object
    * @param level string
    */
   log(...messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   debug(...messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   warn(...messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   info(...messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   error(...messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   trace(...messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }
}
