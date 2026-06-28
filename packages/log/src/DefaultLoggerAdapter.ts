import { AbstractLoggerAdapter, LogLevel, getEnvLogLevel } from './AbstractLoggerAdapter'
import logger from 'loglevel'
import chalk from 'chalk'

/**
 * Default internal implementation relying on `loglevel` and `chalk` for colored console outputs.
 */
export class DefaultLoggerAdapter extends AbstractLoggerAdapter {
   constructor(prefix = '', level: LogLevel = getEnvLogLevel(LogLevel.DEBUG)) {
      super(prefix, level)
      this._logger = logger
      this._logger.setLevel(level)
   }

   /**
    * Log message using defined logger
    * @param messages array
    * @param level LogLevel
    */
   log(messages: any[], level: LogLevel = this._logLevel): void {
      let tag = ''
      if (chalk.level === 0) {
         // Terminal sans support couleur (fallback)
         const levelNames: Record<number, string> = {
            [LogLevel.TRACE]: '[TRC]',
            [LogLevel.DEBUG]: '[DBG]',
            [LogLevel.INFO]: '[INF]',
            [LogLevel.WARN]: '[WRN]',
            [LogLevel.ERROR]: '[ERR]',
            [LogLevel.SILENT]: ''
         }
         tag = ` ${levelNames[level] || '[...]'} `
      }

      const message = this.formatLogMessage(messages, level, tag)

      switch (level) {
         case LogLevel.TRACE:
            this._logger.trace(chalk.grey(message))
            break
         case LogLevel.DEBUG:
            this._logger.debug(chalk.yellow(message))
            break
         case LogLevel.INFO:
            this._logger.info(chalk.green(message))
            break
         case LogLevel.WARN:
            this._logger.warn(chalk.red(message))
            break
         case LogLevel.ERROR:
            this._logger.error(chalk.bgRed.white.bold(message))
            break
         default:
            this._logger.log(message)
            break
      }
   }

   /**
    * Updates the logger to a new verbosity log level.
    * 
    * @param level - The target LogLevel enum.
    */
   logLevel(level: LogLevel): void {
      super.logLevel(level)
      this._logger.setLevel(level)
   }

   /**
    * Debug level shortcut.
    * 
    * @param messages - Variadic payload.
    */
   debug(...messages: any): void {
      this.log(messages, LogLevel.DEBUG)
   }

   /**
    * Warning level shortcut.
    * 
    * @param messages - Variadic payload.
    */
   warn(...messages: any): void {
      this.log(messages, LogLevel.WARN)
   }

   /**
    * Info level shortcut.
    * 
    * @param messages - Variadic payload.
    */
   info(...messages: any): void {
      this.log(messages, LogLevel.INFO)
   }

   /**
    * Error level shortcut.
    * 
    * @param messages - Variadic payload.
    */
   error(...messages: any): void {
      this.log(messages, LogLevel.ERROR)
   }

   /**
    * Trace level shortcut.
    * 
    * @param messages - Variadic payload.
    */
   trace(...messages: any): void {
      this.log(messages, LogLevel.TRACE)
   }
}
