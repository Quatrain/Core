# @quatrain/cloudwrapper

Foundation package for cloud function wrappers. This package provides abstract base classes and type definitions for building cloud function triggers across different platforms (Firebase, Supabase, etc.).

## Features

-  Abstract base class for cloud wrapper implementations
-  Type definitions for database and storage triggers
-  Event payload types for cloud functions
-  Static logger with "Cloud" namespace
-  Platform-agnostic trigger definitions

## Installation

```bash
npm install @quatrain/cloudwrapper
```

## Usage

### Extending AbstractCloudWrapper

```typescript
import { AbstractCloudWrapper } from '@quatrain/cloudwrapper'

class MyCloudWrapper extends AbstractCloudWrapper {
   constructor(params: any) {
      super(params)
      // Your initialization logic
   }

   // Implement your cloud-specific methods
}

const wrapper = new MyCloudWrapper({
   projectId: 'my-project',
   region: 'us-central1',
})
```

### Using CloudWrapper Logger

```typescript
import { CloudWrapper } from '@quatrain/cloudwrapper'

CloudWrapper.logger.info('Cloud function initialized')
CloudWrapper.logger.debug('Processing event...')
CloudWrapper.logger.error('Error occurred:', error)
```

### Database Trigger Definition

```typescript
import { DatabaseTriggerType } from '@quatrain/cloudwrapper'
import { BackendAction } from '@quatrain/backend'

const userTrigger: DatabaseTriggerType = {
   name: 'onUserCreate',
   event: BackendAction.CREATE,
   script: async (payload) => {
      // Handle user creation
      console.log('New user:', payload.after)
   },
   model: 'User',
   path: '/users/{userId}',
   schema: 'public', // Optional
}
```

### Storage Trigger Definition

```typescript
import {
   StorageTriggerType,
   StorageEventPayloadType,
} from '@quatrain/cloudwrapper'
import { BackendAction } from '@quatrain/backend'

const fileTrigger: StorageTriggerType = {
   name: 'onFileUpload',
   event: BackendAction.CREATE,
   script: async (payload: StorageEventPayloadType) => {
      const file = payload.after
      console.log('File uploaded:', file?.fullPath)
      console.log('Size:', file?.size, 'bytes')
   },
}
```

### Multiple Events

```typescript
import { DatabaseTriggerType } from '@quatrain/cloudwrapper'
import { BackendAction } from '@quatrain/backend'

const multiEventTrigger: DatabaseTriggerType = {
   name: 'onPostChange',
   event: [BackendAction.CREATE, BackendAction.UPDATE],
   script: async (payload) => {
      const before = payload.before
      const after = payload.after

      if (!before) {
         console.log('Post created')
      } else {
         console.log('Post updated')
      }
   },
   model: 'Post',
   path: '/posts/{postId}',
}
```

## Type Definitions

### DatabaseTriggerType

Defines triggers for database operations (create, update, delete).

```typescript
interface DatabaseTriggerType {
   name: string
   event: BackendAction | BackendAction[]
   script: Function
   model: string // Database model/table name
   path: string // Path pattern for the trigger
   schema?: string // Optional database schema
}
```

### StorageTriggerType

Defines triggers for storage operations (file upload, update, delete).

```typescript
interface StorageTriggerType {
   name: string
   event: BackendAction | BackendAction[]
   script: Function
}
```

### StorageEventPayloadType

Payload structure for storage events.

```typescript
interface StorageEventPayloadType {
   before: FileType | undefined // File state before event
   after: FileType | undefined // File state after event
   context: any // Additional context
}
```

## Platform Adapters

This package serves as the foundation. Specific implementations are available:

-  **[@quatrain/cloudwrapper-firebase](../cloudwrapper-firebase)** - Firebase Functions adapter
-  **[@quatrain/cloudwrapper-supabase](../cloudwrapper-supabase)** - Supabase Edge Functions adapter

## BackendAction Enum

Triggers use the `BackendAction` enum from `@quatrain/backend`:

-  `BackendAction.CREATE` - Resource creation
-  `BackendAction.UPDATE` - Resource modification
-  `BackendAction.DELETE` - Resource deletion

## License

AGPL-3.0-only
