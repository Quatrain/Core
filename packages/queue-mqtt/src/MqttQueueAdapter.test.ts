import { MqttQueueAdapter, MosquittoQueueAdapter } from './MqttQueueAdapter'

describe('MqttQueueAdapter & MosquittoQueueAdapter Unit Tests', () => {
   it('should initialize with default parameters', () => {
      const adapter = new MqttQueueAdapter({
         config: {
            brokerUrl: 'tcp://127.0.0.1:1883',
            clientId: 'test-client',
         },
      })

      expect(adapter.config.brokerUrl).toBe('tcp://127.0.0.1:1883')
      expect(adapter.config.clientId).toBe('test-client')
      expect(adapter.isConnected).toBe(false)
   })

   it('should export MosquittoQueueAdapter as an alias of MqttQueueAdapter', () => {
      expect(MosquittoQueueAdapter).toBe(MqttQueueAdapter)
   })

   it('should validate MQTT topic wildcard matching logic', () => {
      const adapter = new MqttQueueAdapter({
         config: { brokerUrl: 'tcp://127.0.0.1:1883' },
      })

      const matchTopic = (adapter as any)._matchTopic.bind(adapter)

      // Direct exact equality
      expect(matchTopic('sensors/temperature', 'sensors/temperature')).toBe(true)
      expect(matchTopic('sensors/temperature', 'sensors/humidity')).toBe(false)

      // Single level wildcard (+)
      expect(matchTopic('sensors/+/temperature', 'sensors/probe-1/temperature')).toBe(true)
      expect(matchTopic('sensors/+/temperature', 'sensors/probe-2/temperature')).toBe(true)
      expect(matchTopic('sensors/+/temperature', 'sensors/probe-1/depth-10/temperature')).toBe(false)

      // Multi-level wildcard (#)
      expect(matchTopic('sensors/#', 'sensors/probe-1/depth-10/temperature')).toBe(true)
      expect(matchTopic('#', 'any/topic/hierarchy')).toBe(true)
   })
})
