# @quatrain/queue-mqtt

The universal MQTT message queue adapter for `@quatrain/queue`. Supports **Eclipse Mosquitto**, **EMQX**, **HiveMQ**, **VerneMQ**, **AWS IoT Core**, and **RabbitMQ MQTT**.

---

## 🧭 Introduction

`@quatrain/queue-mqtt` provides high-throughput, non-blocking asynchronous message publishing and subscription over standard **MQTT 3.1.1 and 5.0** brokers.

---

## 🚀 Key Features

- Extends `AbstractQueueAdapter` from `@quatrain/queue`.
- Automatic reconnection with exponential backoff and persistent subscription recovery.
- Full support for MQTT single-level (`+`) and multi-level (`#`) topic wildcards.
- Built-in `MosquittoQueueAdapter` convenience alias.
- Quality of Service (QoS 0, 1, 2) configuration.

---

## 📦 Installation

```bash
npm install @quatrain/queue-mqtt mqtt
# or
bun add @quatrain/queue-mqtt mqtt
```

---

## 🛠️ Quick Start

```typescript
import { Queue } from '@quatrain/queue'
import { MqttQueueAdapter } from '@quatrain/queue-mqtt'

// 1. Initialize and register the MQTT adapter
const mqttAdapter = new MqttQueueAdapter({
   config: {
      brokerUrl: 'tcp://127.0.0.1:1883',
      clientId: 'worker-1',
   },
})
Queue.addAdapter('default', mqttAdapter, true)

// 2. Subscribe to topics with wildcards
const queue = Queue.getAdapter()
queue.listen('application/+/device/+/event/+', (message, topic) => {
   console.log(`Received message on ${topic}:`, message)
})

// 3. Publish messages
await queue.send({ temperature: 24.5 }, 'sensors/probe-1/temperature')
```

For detailed guides, see [HOWTO.md](HOWTO.md).

---

## 📄 License

AGPL-3.0-only
