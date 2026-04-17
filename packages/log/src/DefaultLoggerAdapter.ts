import { AbstractLoggerAdapter, LogLevel } from './AbstractLoggerAdapter'
import logger from 'loglevel'
import chalk from 'chalk'

export class DefaultLoggerAdapter extends AbstractLoggerAdapter {
   constructor(prefix = '', level: LogLevel = LogLevel.DEBUG) {
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

   logLevel(level: LogLevel): void {
      super.logLevel(level)
      this._logger.setLevel(level)
   }

   debug(...messages: any): void {
      this.log(messages, LogLevel.DEBUG)
   }

   warn(...messages: any): void {
      this.log(messages, LogLevel.WARN)
   }

   info(...messages: any): void {
      this.log(messages, LogLevel.INFO)
   }

   error(...messages: any): void {
      this.log(messages, LogLevel.ERROR)
   }

   trace(...messages: any): void {
      this.log(messages, LogLevel.TRACE)
   }
}
