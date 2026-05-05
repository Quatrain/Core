import { Core } from '@quatrain/core'
import os from 'os'
import axios from 'axios'
import { spawn } from 'child_process'
import { HandlerParameters } from './types/HandlerParameters'

export class Worker extends Core {
   static endpoint: string = ''
   static readonly logger = this.addLogger('Worker')

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
         Worker.info(`Executing command ${command} in ${cwd} with arguments:`)
         args.forEach((arg) => console.log(`\t${arg}`))
         return new Promise((resolve, reject) => {
            const child = spawn(command, args, { cwd, shell: false })

            child.stdout.on('data', (data: Buffer) =>
               Worker.debug(data.toString())
            )

            child.stderr.on('data', (data: Buffer) =>
               Worker.debug(data.toString())
            )

            child.on('close', (code) => {
               if (code !== 0) {
                  Worker.error(`Command execution failed with code: ${code}`)
                  reject(new Error(`Process failed and returned code: ${code}`))
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
         Worker.warn(`Events endpoint is not set, can't send update!`)
         return false
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
            Worker.error(`Failed to push event to backend: ${err}`)
            return false
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
         Worker.warn(`Events endpoint is not set, can't send update!`)
         return false
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

         if (res.statusText === 'OK') {
            Worker.info(`Event pushed to backend: ${res.statusText}`)
            return true
         }
      } catch (err) {
         Worker.error(`Failed to push event to backend: ${err}`)
         return false
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
