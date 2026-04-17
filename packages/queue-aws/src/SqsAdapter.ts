import {
   SQSClient,
   SendMessageCommand,
   ReceiveMessageCommand,
   DeleteMessageCommand,
} from '@aws-sdk/client-sqs'
import { Queue, AbstractQueueAdapter, QueueParameters } from '@quatrain/queue'

export class SqsAdapter extends AbstractQueueAdapter {
   protected _logger: any
   constructor(params: QueueParameters) {
      super(params)
      this._logger = (Queue as any).logger.clone('SQS')
      const {
         accesskey = '',
         secret = '',
         region = 'eu-central-1',
         accountid = '',
         endpoint = '',
      } = params.config || {}

      if (!accesskey || !secret || !region || (!accountid && !endpoint)) {
         throw new Error(
            `Missing required parameters for SQS: accesskey, secret, region, and either accountid or endpoint`
         )
      }

      this._client = new SQSClient({
         region,
         credentials: {
            accessKeyId: accesskey,
            secretAccessKey: secret,
         },
         ...(endpoint && { endpoint }),
      })
   }

   async send(data: any, topic: string): Promise<string> {
      let QueueUrl =
         this._params.config.endpoint ||
         `https://sqs.${this._params.config.region || ''}.amazonaws.com`

      QueueUrl += `/${this._params.config.accountid || ''}/${topic}`

      const params = {
         DelaySeconds: 10,
         MessageBody: JSON.stringify(data),
         QueueUrl,
      }

      this._logger.debug(`Sending message to ${QueueUrl}`)
      const command = new SendMessageCommand(params)
      const response = await this._client.send(command)

      return response.MessageId
   }

   /**
    * Listen to a topic
    * @param topic
    */
   async listen(topic: string, handler: (message: any) => Promise<void>) {
      let QueueUrl =
         this._params.config.endpoint ||
         `https://sqs.${this._params.config.region || ''}.amazonaws.com`

      QueueUrl += `/${this._params.config.accountid || ''}/${topic}`

      this._logger.info(`Start listening on ${QueueUrl}`)

      while (true) {
         try {
            const receiveCommand = new ReceiveMessageCommand({
               QueueUrl,
               MaxNumberOfMessages: 1,
               WaitTimeSeconds: 20, // Long polling
            })

            const response = await this._client.send(receiveCommand)

            if (response.Messages && response.Messages.length > 0) {
               this._logger.debug(response.Messages)

               for (const message of response.Messages) {
                  this._logger.debug(`Received message ${message.MessageId}`)

                  try {
                     await handler(message)

                     // Delete message after successful processing
                     const deleteCommand = new DeleteMessageCommand({
                        QueueUrl,
                        ReceiptHandle: message.ReceiptHandle!,
                     })
                     await this._client.send(deleteCommand)
                     this._logger.debug(`Deleted message ${message.MessageId}`)
                  } catch (err: any) {
                     this._logger.error(
                        `Error processing message ${message.MessageId}: ${err.message}`
                     )
                  }
               }
            }
         } catch (err: any) {
            this._logger.error(
               `Error receiving from ${QueueUrl}: ${err.message}`
            )
            // Wait a bit before retrying on error
            await new Promise((resolve) => setTimeout(resolve, 5000))
         }
      }
   }
}
