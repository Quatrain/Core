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

/**
 * Helper to resolve the log level from the environment variables LOGLEVEL or LOG_LEVEL.
 * If not defined or invalid, falls back to the provided default level.
 */
export function getEnvLogLevel(defaultLevel: LogLevel): LogLevel {
   if (typeof process === 'undefined' || !process.env) return defaultLevel
   const envLevel = (process.env.LOGLEVEL || '').toUpperCase()
   if (!envLevel) return defaultLevel
   
   switch (envLevel) {
      case 'TRACE': return LogLevel.TRACE
      case 'DEBUG': return LogLevel.DEBUG
      case 'INFO': return LogLevel.INFO
      case 'WARN': return LogLevel.WARN
      case 'ERROR': return LogLevel.ERROR
      case 'SILENT': return LogLevel.SILENT
      default: return defaultLevel
   }
}

/**
 * Base abstraction for creating custom logging adapters.
 * Ensures consistent log levels and signature formats across implementations.
 */
export abstract class AbstractLoggerAdapter implements LoggerType {
   protected _me: string = ''
   protected _logLevel: LogLevel = getEnvLogLevel(LogLevel.WARN)
   protected _logger: any = undefined

   constructor(prefix = '', _level: LogLevel = getEnvLogLevel(LogLevel.WARN)) {
      this._me = prefix
      this._logLevel = _level
   }

   /**
    * Overrides the current log verbosity level.
    * 
    * @param level - The target LogLevel enum.
    */
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

   /**
    * Safely stringifies and combines all parts of a log payload into a single string.
    * 
    * @param messages - Array of items to log.
    * @param _loglevel - Severity of the log.
    * @param tag - A specific label for the line.
    * @returns Formatted output string.
    */
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

   /**
    * Trigger a debug-level log.
    * 
    * @param _messages - Items to log.
    */
   debug(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   /**
    * Trigger a warn-level log.
    * 
    * @param _messages - Items to log.
    */
   warn(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   /**
    * Trigger an info-level log.
    * 
    * @param _messages - Items to log.
    */
   info(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   /**
    * Trigger an error-level log.
    * 
    * @param _messages - Items to log.
    */
   error(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }

   /**
    * Trigger a trace-level log.
    * 
    * @param _messages - Items to log.
    */
   trace(..._messages: any[]): void {
      throw new Error(`This method needs to be implemtend in child class`)
   }
}
