import { Core } from '@quatrain/core'
import os from 'node:os'
import axios from 'axios'
import { spawn } from 'node:child_process'
import { HandlerParameters } from './types/HandlerParameters'

/**
 * Error thrown when an external command executed by Worker fails with a non-zero exit code.
 * Captures the process exit code, the explanatory reason message extracted from stdout/stderr,
 * as well as the full stdout and stderr streams.
 */
export class ProcessError extends Error {
   /** Exit code returned by the child process. */
   readonly code: number
   /** Explanatory message extracted from process output (typically the last non-empty line). */
   readonly reason: string
   /** Full standard output stream text. */
   readonly stdout: string
   /** Full standard error stream text. */
   readonly stderr: string

   constructor(
      code: number,
      reason: string,
      stdout: string = '',
      stderr: string = ''
   ) {
      super(`Process failed and returned code: ${code}`)
      this.name = 'ProcessError'
      this.code = code
      this.reason = reason
      this.stdout = stdout
      this.stderr = stderr
      Object.setPrototypeOf(this, ProcessError.prototype)
   }
}

/**
 * The core orchestration class for background task workers.
 * Manages event reporting, child process execution, and queue listening.
 */
export class Worker extends Core {
   /** The HTTP endpoint used to push worker status events. */
   static endpoint: string = ''
   /** Dedicated logger instance for the worker subsystem. */
   static readonly logger = this.addLogger('Worker')

   /**
    * Execute an external command in a promise.
    * Captures stdout and stderr streams chronologically, and on failure rejects
    * with a strongly-typed ProcessError containing the explanatory reason.
    *
    * @see https://stackoverflow.com/questions/46289682/how-to-wait-for-child-process-spawn-execution-with-async-await
    * @see https://dzone.com/articles/understanding-execfile-spawn-exec-and-fork-in-node
    * @param command - The executable command string.
    * @param args - Arguments to pass to the command.
    * @param cwd - Working directory for the child process.
    * @return Promise resolving on clean exit (code 0) or rejecting with ProcessError.
    */
   static readonly execPromise = (
      command: string,
      args: string[] = [],
      cwd = process.cwd()
   ): Promise<void> => {
      try {
         Worker.info(`Executing command ${command} in ${cwd} with arguments:`)
         args.forEach((arg) => console.log(`\t${arg}`))
         return new Promise((resolve, reject) => {
            const child = spawn(command, args, { cwd, shell: false })
            const outputLines: string[] = []
            let stdout = ''
            let stderr = ''

            child.stdout.on('data', (data: Buffer) => {
               const str = data.toString()
               stdout += str
               const lines = str.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
               outputLines.push(...lines)
               Worker.debug(str)
            })

            child.stderr.on('data', (data: Buffer) => {
               const str = data.toString()
               stderr += str
               const lines = str.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
               outputLines.push(...lines)
               Worker.debug(str)
            })

            child.on('close', (code) => {
               if (code !== 0) {
                  const exitCode = typeof code === 'number' ? code : 1
                  const reason =
                     outputLines.length > 0
                        ? outputLines[outputLines.length - 1]
                        : `Process failed and returned code: ${exitCode}`
                  Worker.error(
                     `Command execution failed with code: ${exitCode} - ${reason}`
                  )
                  reject(new ProcessError(exitCode, reason, stdout, stderr))
               } else {
                  Worker.info(`Command execution completed with code: ${code}`)
                  resolve(undefined)
               }
            })
         })
      } catch (err) {
         Worker.error((err as Error).message)
         throw err
      }
   }

   /**
    * Push an event to the backend endpoint, if available
    * @param event string
    * @param data
    * @param ts timestamp
    * @returns boolean
    */
   static pushEvent(event: string, data = {}, ts = 0) {
      if (!this.endpoint) {
         Worker.error(`Events endpoint is mandatory but missing! Cannot report job status to source.`)
         throw new Error(`Events endpoint is mandatory but missing`)
      }

      ts = ts === Date.now() ? Date.now() + 1 : Date.now()
      const payload = {
         event,
         worker: `Container ${os.hostname}`,
         os: `${os.type} ${os.release} (${os.platform} ${os.arch})`,
         ...data,
         ts,
      }

      Worker.debug('event payload', payload)

      axios
         .patch(Worker.endpoint, payload)
         .then((res) => {
            Worker.info(`Event pushed to backend: ${res.statusText}`)
            Worker.info(res.data)
            return true
         })
         .catch((err) => {
            Worker.error(`Failed to push event to backend: ${err.message}`)
         })
   }

   /**
    * Async Push an event to the backend endpoint, if available
    * @param event string
    * @param data
    * @param ts timestamp
    * @returns boolean
    */
   static async pushEventAsync(event: string, data = {}, ts = 0) {
      if (!this.endpoint) {
         Worker.error(`Events endpoint is mandatory but missing! Cannot report job status to source.`)
         throw new Error(`Events endpoint is mandatory but missing`)
      }

      try {
         ts = ts === Date.now() ? Date.now() + 1 : Date.now()
         const payload = {
            event,
            worker: `Container ${os.hostname}`,
            os: `${os.type} ${os.release} (${os.platform} ${os.arch})`,
            ...data,
            ts,
         }

         const res = await axios.patch(Worker.endpoint, payload)

         if (res.statusText === 'OK' || res.status === 200) {
            Worker.info(`Event pushed to backend: ${res.statusText}`)
            return true
         }
      } catch (err: any) {
         Worker.error(`Failed to push event to backend: ${err.message}`)
         throw new Error(`Failed to push event to backend: ${err.message}`)
      }
   }

   /**
    * Global handling function to process received messages
    * @param messageHandler function
    * @param config object
    */
   static readonly handler = async (
      messageHandler: Function,
      config: HandlerParameters
   ) => {
      try {
         switch (config.mode) {
            case 'queue':
               const { Queue } = require('@quatrain/queue')
               Queue.addQueue(config.queueAdapter, 'default', true)
               Queue.getQueue().listen(config.topic, messageHandler, {
                  concurrency: config.concurrency,
                  gpu: config.gpu,
               })
               Queue.info(
                  `Connected and listening to ${config.topic}, ready to receive messages.`
               )
               break

            case 'cli':
            case 'test':
               Worker.warn(`Message received from CLI.`)
               const json =
                  config.mode === 'test'
                     ? require('../test.json')
                     : process.env.JSON

               if (!json) {
                  throw new Error(`CLI call with missing environment variables`)
               }

               await messageHandler(json)
               break

            default:
               Worker.error(`Unknown mode option: '${config.mode}'`)
               process.exit(1)
         }
      } catch (error) {
         Worker.error((error as Error).message)
         process.exit(1)
      }
   }
}
