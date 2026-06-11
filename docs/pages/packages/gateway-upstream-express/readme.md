# @quatrain/gateway-upstream-express

A plug-and-play Express router designed to integrate any Express application with `@quatrain/api-gateway`.

This package exposes a dedicated `/media/:uid` endpoint designed for secure, internal infrastructure communication. It abstracts away security and protocol validation, allowing the upstream API to focus solely on resolving media file locations.

## Usage

```typescript
import express from 'express'
import { createGatewayRouter } from '@quatrain/gateway-upstream-express'

const app = express()

// Mount the gateway router under a dedicated internal prefix
app.use('/internal', createGatewayRouter({
  secret: process.env.GATEWAY_SECRET || 'your-shared-secret',
  onResolveMedia: async (req, uid, action) => {
    // 1. Validate if the request/user has access
    // 2. Resolve the media URL (e.g., from S3)
    
    return {
      url: 'https://s3.amazonaws.com/my-bucket/media.jpg',
      size: 1048576, // optional
      mimeType: 'image/jpeg' // optional
    }
  }
}))
```

## Security
This endpoint is protected by a shared secret (`GATEWAY_SECRET`). The Gateway will automatically append this secret in the `Authorization: Bearer <secret>` header when proxying media requests.

## Documentation

For a detailed explanation of the architecture, the sequence of operations, and a diagram of the workflow, please refer to the [How-To Guide](HOWTO.md).
