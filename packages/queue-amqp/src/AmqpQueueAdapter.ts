import { AbstractQueueAdapter, Queue } from '@quatrain/queue'
import amqplib, { ChannelModel, ConsumeMessage, Message } from 'amqplib'

export class AmqpQueueAdapter extends AbstractQueueAdapter {
   protected _client: ChannelModel | undefined
   protected _logger: any

   constructor(params: any) {
      super(params)
      this._logger = (Queue as any).logger.clone('AMQP')
   }

   protected async _connect(): Promise<ChannelModel> {
      if (!this._client) {
         const {
            host = 'localhost',
            user = 'guest',
            password = 'guest',
            port = 5672,
         } = this._params.config || {}

         this._client = await amqplib.connect(
            `amqp://${user}:${password}@${host}:${port}`
         )
      }

      return this._client
   }

   protected async _disconnect() {
      await this._client?.close()
   }

   async send(data: any, topic: string): Promise<string> {
      await this._connect()

      const channel = await this._client?.createChannel()

      const dataBuffer = Buffer.from(JSON.stringify(data))
      this._logger.info(`Sending message to ${topic}`)

      channel?.sendToQueue(topic, dataBuffer)
      channel?.close()

      const id = Date.now() // fake
      this._logger.info(`Message send with id ${id}`)

      return String(id)
   }

   /**
    * Listen to given queue and process messages with messageHandler function
    * @param topic
    * @param messageHandler
    * @param params
    * @returns
    */
   async listen(
      topic: string | undefined = this._params.topic,
      messageHandler: Function,
      params?: any
   ) {
      if (!topic) {
         throw new Error(`No topic provided for listening.`)
      }

      const concurrency = params?.concurrency || 0

      this._logger.info(
         `Starting to listen to topic ${topic} with max concurrency set to ${concurrency}`
      )

      let concurrents = 0
      const client = await this._connect()
      const channel = await client.createChannel()

      await channel.assertQueue(topic, { durable: true, autoDelete: false })
      await channel.prefetch(concurrency) // only get one message at a time

      return channel.consume(
         topic,
         async (msg: ConsumeMessage | null) => {
            if (msg === null || !channel) {
               return
            }

            concurrents++
            this._logger.info(
               `Job #${concurrents} of ${
                  concurrency > 0 ? concurrency : 'unlimited'
               } started`
            )

            try {
               // 1. Process the message synchronously (wait for it to finish)
               const result = await messageHandler(
                  msg.content.toString(),
                  params
               )

               if (result === false) {
                  throw new Error(
                     'messageHandler function failed, see status log in jobExecution for more information'
                  )
               }

               // 2. Acknowledge the message only after successful processing
               channel.ack(msg)

               // 3. Check if we reached the limit of messages to process
               if (concurrency > 0 && concurrents >= concurrency) {
                  this._logger.info(
                     `Reached max concurrency of ${concurrency}, disconnecting from queue`
                  )
                  await channel.close()
                  await client.close()
                  process.exit(0)
               }
            } catch (err) {
               this._logger.error(
                  `messageHandler function failed with message: ${
                     (err as Error).message
                  }`
               )
               // Negative acknowledge the message so it can be requeued or handled by DLQ
               channel.nack(msg)
               process.exit(1)
            }
         },
         { noAck: false } // disable auto-hack
      )
   }
}
