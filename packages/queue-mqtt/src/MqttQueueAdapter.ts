import { AbstractQueueAdapter } from '@quatrain/queue'
import mqtt, { type MqttClient, type IClientOptions } from 'mqtt'

export interface MqttQueueConfig {
   brokerUrl: string
   clientId?: string
   username?: string
   password?: string
   reconnectPeriodMs?: number
   connectTimeoutMs?: number
   defaultQos?: 0 | 1 | 2
   dryRun?: boolean
   clientOptions?: IClientOptions
}

/**
 * Universal MQTT Queue Adapter for Quatrain
 * Extends AbstractQueueAdapter from @quatrain/queue to provide
 * high-performance, non-blocking asynchronous message publishing and subscription
 * across Mosquitto, EMQX, HiveMQ, AWS IoT, and RabbitMQ MQTT brokers.
 */
export class MqttQueueAdapter extends AbstractQueueAdapter {
   protected _client: any = null
   private _config: MqttQueueConfig

   private _isConnected: boolean = false
   private _activeSubscriptions: Set<string> = new Set()
   private _handlers: Map<string, Function[]> = new Map()

   constructor(params: { config: MqttQueueConfig }) {
      super(params as any)
      this._config = {
         brokerUrl: params.config?.brokerUrl || process.env.MQTT_BROKER_URL || 'tcp://127.0.0.1:1883',
         clientId: params.config?.clientId || `quatrain-mqtt-${Math.random().toString(16).slice(2, 8)}`,
         username: params.config?.username || process.env.MQTT_USERNAME,
         password: params.config?.password || process.env.MQTT_PASSWORD,
         reconnectPeriodMs: params.config?.reconnectPeriodMs || 3000,
         connectTimeoutMs: params.config?.connectTimeoutMs || 10000,
         defaultQos: params.config?.defaultQos || 1,
         dryRun: params.config?.dryRun || false,
         clientOptions: params.config?.clientOptions,
      }
   }

   /**
    * Current broker connection status
    */
   get isConnected(): boolean {
      return this._isConnected
   }

   /**
    * Active configuration
    */
   get config(): MqttQueueConfig {
      return this._config
   }

   /**
    * Connects to the MQTT broker and sets up event listeners
    */
   async connect(): Promise<MqttClient> {
      if (this._client && this._isConnected) {
         return this._client
      }

      return new Promise((resolve, reject) => {
         try {
            this._client = mqtt.connect(this._config.brokerUrl, {
               clientId: this._config.clientId,
               reconnectPeriod: this._config.reconnectPeriodMs,
               connectTimeout: this._config.connectTimeoutMs,
               username: this._config.username,
               password: this._config.password,
               ...this._config.clientOptions,
            })

            this._client.on('connect', () => {
               this._isConnected = true

               // Re-subscribe to all active topics upon reconnect
               for (const topic of this._activeSubscriptions) {
                  this._client?.subscribe(topic, { qos: this._config.defaultQos || 1 }, (err: any) => {
                     if (err) {
                        console.error(`[MqttQueueAdapter] Re-subscribe failed for topic "${topic}":`, err.message)
                     }
                  })
               }
               resolve(this._client!)
            })

            this._client.on('message', async (topic: string, payload: Buffer) => {
               await this._dispatchMessage(topic, payload)
            })

            this._client.on('error', (err: any) => {
               console.error('[MqttQueueAdapter] Connection error:', err.message)
               this._isConnected = false
            })


            this._client.on('close', () => {
               this._isConnected = false
            })

            this._client.on('offline', () => {
               this._isConnected = false
            })
         } catch (err) {
            reject(err)
         }
      })
   }

   /**
    * Dispatches incoming MQTT message buffer to matching registered handlers
    */
   private async _dispatchMessage(topic: string, payload: Buffer): Promise<void> {
      let parsedData: any
      try {
         const rawString = payload.toString('utf-8')
         parsedData = JSON.parse(rawString)
      } catch {
         // Fallback to raw string if not JSON
         parsedData = payload.toString('utf-8')
      }

      for (const [subscribedPattern, handlers] of this._handlers.entries()) {
         if (this._matchTopic(subscribedPattern, topic)) {
            for (const handler of handlers) {
               try {
                  await handler(parsedData, topic)
               } catch (handlerErr: any) {
                  console.error(`[MqttQueueAdapter] Error executing handler for topic "${topic}":`, handlerErr.message)
               }
            }
         }
      }
   }

   /**
    * Evaluates MQTT topic pattern matching with single-level (+) and multi-level (#) wildcards
    */
   private _matchTopic(pattern: string, topic: string): boolean {
      if (pattern === topic || pattern === '#') return true

      const patternParts = pattern.split('/')
      const topicParts = topic.split('/')

      for (let i = 0; i < patternParts.length; i++) {
         const p = patternParts[i]
         if (p === '#') return true
         if (p !== '+' && p !== topicParts[i]) return false
      }

      return patternParts.length === topicParts.length
   }

   /**
    * Publishes a message payload to a specified MQTT topic
    * Implements AbstractQueueAdapter.send()
    */
   async send(data: any, topic: string): Promise<string> {
      if (!this._client || !this._isConnected) {
         await this.connect()
      }

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const payloadString = typeof data === 'string' ? data : JSON.stringify(data)

      return new Promise((resolve, reject) => {
         this._client?.publish(
            topic,
            payloadString,
            { qos: this._config.defaultQos || 1 },
            (err: any) => {
               if (err) {
                  reject(err)
               } else {
                  resolve(messageId)
               }
            },
         )
      })
   }

   /**
    * Starts a background listener on a given queue topic or MQTT wildcard pattern
    * Implements AbstractQueueAdapter.listen()
    */
   listen(
      topic: string,
      handler: Function,
      _params?: { concurrency?: number; gpu?: boolean },
   ): any {
      if (!this._handlers.has(topic)) {
         this._handlers.set(topic, [])
      }
      this._handlers.get(topic)!.push(handler)
      this._activeSubscriptions.add(topic)

      if (this._client && this._isConnected) {
         this._client.subscribe(topic, { qos: this._config.defaultQos || 1 }, (err: any) => {
            if (err) {
               console.error(`[MqttQueueAdapter] Subscribe error on topic "${topic}":`, err.message)
            }
         })
      }
 else {
         this.connect().catch((err) => {
            console.error('[MqttQueueAdapter] Auto-connect on listen failed:', err.message)
         })
      }

      return {
         unsubscribe: () => {
            this._activeSubscriptions.delete(topic)
            this._handlers.delete(topic)
            this._client?.unsubscribe(topic)
         },
      }
   }

   /**
    * Gracefully terminates the MQTT client connection
    */
   async close(): Promise<void> {
      return new Promise((resolve) => {
         if (this._client) {
            this._client.end(false, () => {
               this._isConnected = false
               resolve()
            })
         } else {
            resolve()
         }
      })
   }
}

/**
 * Convenience alias for Mosquitto environments
 */
export const MosquittoQueueAdapter = MqttQueueAdapter
