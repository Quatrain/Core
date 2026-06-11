# @quatrain/queue-amqp

The AMQP (Advanced Message Queuing Protocol) adapter for `@quatrain/queue`. 

## Introduction

This adapter enables communication with AMQP 0-9-1 brokers such as RabbitMQ. It is ideal for high-throughput, low-latency messaging requirements where you have full control over the broker infrastructure.

## Installation

```bash
npm install @quatrain/queue-amqp amqplib
# or
yarn add @quatrain/queue-amqp amqplib
```

## Configuration

Register the adapter by providing the connection URL for your AMQP broker.

```typescript
import { Queue } from '@quatrain/queue'
import { AmqpQueueAdapter } from '@quatrain/queue-amqp'

const amqpAdapter = new AmqpQueueAdapter({
    config: {
        url: 'amqp://user:password@localhost:5672',
        // Optional: specify an exchange if not using default
        exchange: 'quatrain-exchange' 
    }
})

Queue.addAdapter('rabbitmq', amqpAdapter, true)
```

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
