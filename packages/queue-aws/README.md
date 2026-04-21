# @quatrain/queue-aws

The AWS SQS (Simple Queue Service) adapter for `@quatrain/queue`.

## Introduction

Amazon SQS is a fully managed message queuing service. This adapter utilizes the AWS SDK v3 to send and long-poll messages, providing a serverless, highly scalable queueing backend for Quatrain workers.

## Installation

```bash
npm install @quatrain/queue-aws @aws-sdk/client-sqs
# or
yarn add @quatrain/queue-aws @aws-sdk/client-sqs
```

## Configuration

Register the adapter using your AWS IAM credentials.

```typescript
import { Queue } from '@quatrain/queue'
import { SqsAdapter } from '@quatrain/queue-aws'

const sqsAdapter = new SqsAdapter({
    config: {
        accesskey: process.env.AWS_ACCESS_KEY_ID,
        secret: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'eu-central-1',
        accountid: '1234567890',
        // Provide endpoint if using an SQS-compatible service (e.g. Scaleway Messaging)
        endpoint: 'https://sqs.eu-central-1.amazonaws.com'
    }
})

Queue.addAdapter('sqs', sqsAdapter, true)
```

## License

AGPL-3.0-only
