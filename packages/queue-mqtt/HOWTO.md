# How To: Using @quatrain/queue-mqtt

This guide covers common integration patterns and deployment configurations for `@quatrain/queue-mqtt`.

---

## 1. Registering the Adapter

```typescript
import { Queue } from '@quatrain/queue'
import { MqttQueueAdapter } from '@quatrain/queue-mqtt'

const mqttAdapter = new MqttQueueAdapter({
   config: {
      brokerUrl: process.env.MQTT_BROKER_URL || 'tcp://localhost:1883',
      clientId: 'my-worker-id',
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      reconnectPeriodMs: 3000,
      defaultQos: 1,
   },
})

Queue.addAdapter('mqtt', mqttAdapter, true)
```

---

## 2. Subscribing to Hierarchical Topics (Wildcards)

```typescript
import { Queue } from '@quatrain/queue'

const queue = Queue.getAdapter()

// Single-level wildcard (+)
const sub = queue.listen('tenants/+/sensors/temperature', async (payload, topic) => {
   console.log(`[${topic}] Temperature:`, payload.value)
})

// To unsubscribe later:
// sub.unsubscribe()
```

---

## 3. Graceful Termination

```typescript
process.on('SIGTERM', async () => {
   const adapter = Queue.getAdapter() as MqttQueueAdapter
   await adapter.close()
   process.exit(0)
})
```
