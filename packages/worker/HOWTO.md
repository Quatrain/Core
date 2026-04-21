# How To: Using @quatrain/worker

This guide covers common use cases for building background processors and daemons using `@quatrain/worker`.

## Table of Contents
1. [Setting up a basic Worker](#1-setting-up-a-basic-worker)
2. [Executing external CLI commands](#2-executing-external-cli-commands)
3. [Reporting progress to a backend API](#3-reporting-progress-to-a-backend-api)
4. [Using FileSystem Helpers](#4-using-filesystem-helpers)

---

## 1. Setting up a basic Worker

The standard pattern for setting up a worker is to define a handler function, and then pass it to `Worker.handler()` along with configuration options.

```typescript
import { Worker, HandlerParameters } from '@quatrain/worker'
import { SqsAdapter } from '@quatrain/queue-aws' // Or AmqpQueueAdapter

// 1. Define your processing logic
const messageHandler = async (payload: any) => {
    Worker.info('Received a new job to process:', payload.jobId)
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    Worker.info('Job successfully completed!')
    return true // Return true to acknowledge and delete the message from the queue
}

// 2. Configure the worker
const config: HandlerParameters = {
    mode: 'queue', // Can be 'queue', 'cli', or 'test'
    topic: 'MyTaskQueue',
    queueAdapter: new SqsAdapter({
        config: {
            accesskey: process.env.AWS_KEY,
            secret: process.env.AWS_SECRET,
            region: 'eu-central-1',
            accountid: '1234567890'
        }
    }),
    concurrency: 1 // Process one message at a time
}

// 3. Start the worker loop
Worker.handler(messageHandler, config)
```

## 2. Executing external CLI commands

Workers often need to run external binaries (e.g., `ffmpeg`, `imagemagick`, or python scripts). The `Worker.execPromise` method wraps Node.js `spawn` and pipes the output directly to the Quatrain logger.

```typescript
import { Worker } from '@quatrain/worker'

async function transcodeVideo(inputPath: string, outputPath: string) {
    try {
        Worker.info(`Starting transcoding for ${inputPath}`)
        
        // Command, Arguments, Working Directory
        await Worker.execPromise(
            'ffmpeg',
            ['-i', inputPath, '-vcodec', 'libx264', outputPath],
            '/tmp/worker-dir'
        )
        
        Worker.info('Transcoding completed successfully')
    } catch (error) {
        Worker.error('Transcoding failed!', error.message)
        throw error
    }
}
```

## 3. Reporting progress to a backend API

If you have a central API tracking job progress, you can define an endpoint. The worker will push updates formatted seamlessly.

```typescript
import { Worker } from '@quatrain/worker'

// Configure the reporting endpoint once
Worker.endpoint = 'https://api.myproject.com/internal/webhooks/worker-events'

async function processData(jobId: string) {
    // Fire and forget progress updates
    Worker.pushEvent('job.started', { jobId, progress: 0 })
    
    // ... do some work ...
    
    // Or wait for the update to be acknowledged using the async version
    await Worker.pushEventAsync('job.completed', { 
        jobId, 
        progress: 100, 
        result: 'Success' 
    })
}
```

## 4. Using FileSystem Helpers

Avoid using standard Node.js `fs` directly when writing workers; instead, use the unified `FileSystem` wrapper provided.

```typescript
import { FileSystem } from '@quatrain/worker'

// Synchronous and asynchronous helpers for common disk operations
const tempDir = FileSystem.createTempDir('my-worker')
console.log(`Created workspace at: ${tempDir}`)

// Check if a path exists
if (FileSystem.exists(tempDir)) {
    // Delete a folder and all its contents recursively
    FileSystem.remove(tempDir)
}
```
