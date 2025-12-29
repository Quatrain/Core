import { AbstractQueueAdapter } from './AbstractQueueAdapter'
import { QueueParameters } from './types/QueueParameters'

/**
 * Mock Queue Adapter for testing purposes
 */
export class MockQueueAdapter extends AbstractQueueAdapter {
   private messages: Map<string, any[]> = new Map()
   private handlers: Map<string, Function> = new Map()

   constructor(params: QueueParameters) {
      super(params)
   }

   async send(data: any, topic: string): Promise<string> {
      // Store message in the topic's message array
      if (!this.messages.has(topic)) {
         this.messages.set(topic, [])
      }

      const messages = this.messages.get(topic)!
      messages.push(data)

      // Generate a mock message ID
      const messageId = `msg-${Date.now()}-${Math.random()
         .toString(36)
         .substring(7)}`

      // If there's a handler registered for this topic, invoke it
      const handler = this.handlers.get(topic)
      if (handler) {
         // Simulate async message processing
         setTimeout(() => handler(data), 0)
      }

      return messageId
   }

   listen(
      topic: string,
      handler: Function,
      params?: { concurrency?: number; gpu?: boolean }
   ): any {
      // Register the handler for this topic
      this.handlers.set(topic, handler)

      // Return a mock listener object
      return {
         topic,
         handler,
         concurrency: params?.concurrency || 1,
         gpu: params?.gpu || false,
      }
   }

   // Helper methods for testing
   getMessages(topic: string): any[] {
      return this.messages.get(topic) || []
   }

   clearMessages(topic?: string): void {
      if (topic) {
         this.messages.delete(topic)
      } else {
         this.messages.clear()
      }
   }

   clearHandlers(topic?: string): void {
      if (topic) {
         this.handlers.delete(topic)
      } else {
         this.handlers.clear()
      }
   }

   clearAll(): void {
      this.clearMessages()
      this.clearHandlers()
   }

   hasHandler(topic: string): boolean {
      return this.handlers.has(topic)
   }

   getMessageCount(topic: string): number {
      return this.getMessages(topic).length
   }
}
