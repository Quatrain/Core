# @quatrain/queue-gcp

The Google Cloud Pub/Sub adapter for `@quatrain/queue`.

## Introduction

Google Cloud Pub/Sub is a global messaging and routing service. While slightly different from traditional queues (it's built around publishers and subscribers), this adapter maps the Quatrain queue API to Pub/Sub topics and subscriptions to facilitate background workers.

## Installation

```bash
npm install @quatrain/queue-gcp @google-cloud/pubsub
# or
yarn add @quatrain/queue-gcp @google-cloud/pubsub
```

## Configuration

Register the adapter using your Google Cloud credentials.

```typescript
import { Queue } from '@quatrain/queue'
import { PubSubAdapter } from '@quatrain/queue-gcp'

const pubsubAdapter = new PubSubAdapter({
    config: {
        projectId: process.env.GCP_PROJECT_ID,
        clientEmail: process.env.GCP_CLIENT_EMAIL,
        privateKey: process.env.GCP_PRIVATE_KEY
    }
})

Queue.addAdapter('pubsub', pubsubAdapter, true)
```

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
