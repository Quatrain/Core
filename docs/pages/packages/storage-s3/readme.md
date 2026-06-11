# @quatrain/storage-s3

The AWS S3 (and S3-compatible) adapter for `@quatrain/storage`.

## Introduction

This adapter enables file operations across Amazon S3, Scaleway Object Storage, DigitalOcean Spaces, or any other S3-compatible service.

## Installation

```bash
npm install @quatrain/storage-s3 @aws-sdk/client-s3
# or
yarn add @quatrain/storage-s3 @aws-sdk/client-s3
```

## Configuration

Initialize the adapter with your S3 credentials and endpoint.

```typescript
import { Storage } from '@quatrain/storage'
import { S3Adapter } from '@quatrain/storage-s3'

const s3Adapter = new S3Adapter({
    config: {
        accesskey: process.env.AWS_ACCESS_KEY_ID,
        secret: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'eu-west-1',
        // Provide endpoint if using an S3-compatible service like Scaleway
        endpoint: 'https://s3.fr-par.scw.cloud'
    }
})

Storage.addAdapter('s3', s3Adapter, true)
```

## Documentation

For concrete examples and usage guides, please refer to the [How-To Guide](HOWTO.md).

## License

AGPL-3.0-only
