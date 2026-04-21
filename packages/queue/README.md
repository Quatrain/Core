# @quatrain/queue

The central queue and message broker abstraction for the Quatrain framework. This package provides a unified API for sending and listening to asynchronous messages across different queueing systems.

## Introduction

Asynchronous communication is vital for distributed systems. Whether you are dispatching jobs to workers or broadcasting events, `@quatrain/queue` ensures your code remains clean and independent of the underlying message broker technology (RabbitMQ, AWS SQS, GCP PubSub, etc.).

## Key Concepts

- **`Queue`**: The static registry used to configure and retrieve queue adapters.
- **`AbstractQueueAdapter`**: The base class that all specific queue implementations must extend. Defines methods like `send()` and `listen()`.

## Installation

```bash
npm install @quatrain/queue
# You will also need an adapter, e.g.:
npm install @quatrain/queue-amqp
```

## Architecture

You register your chosen adapter to the `Queue` registry at startup. From anywhere in your application, you can then retrieve the queue adapter and dispatch messages to specific topics. The `@quatrain/worker` package uses this abstraction heavily to listen for incoming jobs.

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
