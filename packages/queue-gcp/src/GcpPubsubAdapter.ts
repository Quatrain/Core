import { Core } from '@quatrain/core'
import { AbstractQueueAdapter, QueueParameters } from '@quatrain/queue'
import { PubSub } from '@google-cloud/pubsub'

export class PubSubQueueAdapter extends AbstractQueueAdapter {
   constructor(params: QueueParameters) {
      super(params)
      const { projectId, keyFilename } = (params.config as any) || {}

      this._client = new PubSub({
         projectId,
         keyFilename,
      })
   }

   async send(data: any, topic: string): Promise<string> {
      const dataBuffer = Buffer.from(JSON.stringify(data))
      const messageId = await this._client.topic(topic).publish(dataBuffer)

      Core.log(`[Pubsub] Sending message to ${topic}`)

      return messageId
   }

   listen(topic: string) {
      return this._client.topic(topic).onPublish()
   }
}
