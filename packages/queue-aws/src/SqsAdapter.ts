import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { Queue, AbstractQueueAdapter, QueueParameters } from '@quatrain/queue'

export class SqsAdapter extends AbstractQueueAdapter {
   constructor(params: QueueParameters) {
      super(params)
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
      const params = {
         DelaySeconds: 10,
         MessageBody: JSON.stringify(data),
         QueueUrl: this._params.config.endpoint
            ? `${this._params.config.endpoint}/${topic}`
            : `https://sqs.${
                 this._params.config.region || ''
              }.amazonaws.com/${this._params.config.accountid || ''}/${topic}`,
      }

      Queue.debug(`[SQS] Sending message to ${params.QueueUrl}`)
      const command = new SendMessageCommand(params)
      const response = await this._client.send(command)

      return response.MessageId
   }

   /**
    * Listen to a topic
    * @param topic
    */
   listen(topic: string) {
      throw new Error(`Unavailable method on this adapter`)
   }
}
