# Quatrain Core - Packages Overview

Quatrain Core is a modular TypeScript framework designed to accelerate business application development with
**Backend as a Service (BaaS)** solutions like Firebase and Supabase. The framework provides clean separation
of concerns between logic, data, and storage, using an adapter pattern to provide consistent interfaces across
different BaaS providers.

## 🎯 Backend as a Service Focus

The framework is specifically designed for modern **Backend as a Service** platforms that provide:

-  **Managed databases** (Firestore, Supabase Postgres)
-  **Authentication services** (Firebase Auth, Supabase Auth)
-  **Real-time capabilities** (Firestore real-time, Supabase real-time)
-  **Storage solutions** (Firebase Storage, Supabase Storage)
-  **Edge functions** (Firebase Functions, Supabase Edge Functions)

**Deployment Flexibility**: Solutions like Supabase work seamlessly whether deployed as:

-  **SaaS** (hosted by Supabase)
-  **Self-hosted** via Docker Compose
-  **Kubernetes** for enterprise deployments
-  **On-premise** for data sovereignty requirements

## 🏗️ Architecture

The framework is organized as a monorepo with core packages and **BaaS-focused adapters**:

```bash
@quatrain/core (Foundation - works standalone)
├── 🔥 Firebase Ecosystem
│   ├── @quatrain/backend-firestore (Firestore NoSQL)
│   ├── @quatrain/auth-firebase (Firebase Auth)
│   ├── @quatrain/storage-firebase (Firebase Storage)
│   ├── @quatrain/cloudwrapper-firebase (Firebase Functions)
│   └── @quatrain/messaging-firebase (FCM)
├── 🟢 Supabase Ecosystem
│   ├── @quatrain/backend-postgres (PostgreSQL - works with Supabase)
│   ├── @quatrain/auth-supabase (Supabase Auth)
│   ├── @quatrain/storage-supabase (Supabase Storage)
│   └── @quatrain/cloudwrapper-supabase (Supabase Edge Functions)
├── 📊 Traditional Backends (for migration/hybrid scenarios)
│   ├── @quatrain/backend-sqlite (Local development)
│   └── @quatrain/storage-s3 (S3-compatible storage)
├── 📬 Message Queues (for complex workflows)
│   ├── @quatrain/queue-amqp (RabbitMQ)
│   ├── @quatrain/queue-aws (AWS SQS)
│   └── @quatrain/queue-gcp (Google Pub/Sub)
├── @quatrain/log (Structured logging)
└── @quatrain/worker (Background processing)
```

## 📦 Core Packages

### @quatrain/core

**Foundation package providing base components and business objects - works standalone without persistence**

⚠️ **Important**: The core package can be used independently for in-memory object management, validation,
and business logic. Persistence capabilities are added separately through the `@quatrain/backend` package and
its adapters.

-  **Base Objects**: `BaseObject`, `AbstractObject`, `DataObject` - Work entirely in memory
-  **Built-in Models**: `User`, `Entity` with full property definitions - No database required
-  **Property System**: Strong typing with validation (`StringProperty`, `NumberProperty`, `DateTimeProperty`, etc.)
-  **Object URI**: Unified resource identification system - Works with or without persistence
-  **Status Management**: Built-in status lifecycle (`created`, `pending`, `active`, `deleted`)
-  **Business Logic**: Complete object lifecycle management without requiring database connections

```typescript
import { BaseObject, StringProperty, User } from '@quatrain/core'

// Create a custom model
export class Product extends BaseObject {
   static COLLECTION = 'products'
   static PROPS_DEFINITION = [
      {
         name: 'name',
         type: StringProperty.TYPE,
         mandatory: true,
         minLength: 1,
         maxLength: 100,
      },
      {
         name: 'price',
         type: NumberProperty.TYPE,
         mandatory: true,
         min: 0,
      },
   ]
}

// Use built-in User model (no database required)
const user = await User.factory()
user._.firstname = 'John'
user._.lastname = 'Doe'
user._.email = 'john@example.com'

// All validation and business logic works without persistence
console.log(user._.name) // "John Doe" (auto-generated)
console.log(user.isValid()) // true/false based on validation rules
```

#### Using Core Without Persistence

The core package is fully functional without any backend dependencies:

```typescript
import { User, Entity, StringProperty } from '@quatrain/core'

// Create and validate objects in memory
const user = await User.factory()
user._.firstname = 'Jane'
user._.email = 'jane@example.com'

// Validation works without database
if (user.isValid()) {
   console.log('User is valid')
}

// Business logic and relationships work in memory
const entity = await Entity.factory()
entity._.name = 'ACME Corp'
user._.entity = entity

// Object serialization/deserialization
const userData = user.toJSON()
const newUser = await User.factory(userData)
```

### @quatrain/backend

**Database abstraction layer with CRUD operations and querying - adds persistence to core objects**

-  **Abstract Base**: `AbstractBackendAdapter` for consistent database interfaces
-  **Query Builder**: Advanced filtering, sorting, and pagination
-  **Repositories**: Business logic layer for data operations
-  **Middleware Support**: Data transformation and validation hooks

```typescript
import { Backend, Filter, OperatorKeys, User } from '@quatrain/backend'

// Query with filters
const users = await backend.find(
   User.factory(),
   [
      new Filter('status', 'active', OperatorKeys.equals),
      new Filter('email', '@company.com', OperatorKeys.like),
   ],
   { limits: { batch: 10, offset: 0 } }
)

// Repository pattern
class UserRepository extends BaseRepository<User> {
   async findActiveUsers() {
      return this.find([new Filter('status', 'active', OperatorKeys.equals)])
   }
}
```

### @quatrain/auth

**Authentication and authorization abstractions**

-  **User Management**: Registration, login, profile updates
-  **Token Handling**: JWT verification and refresh
-  **Middleware Integration**: Auth checks for backend operations

```typescript
import { Auth } from '@quatrain/auth'
import { FirebaseAuthAdapter } from '@quatrain/auth-firebase'

// Setup authentication
Auth.addAdapter(
   new FirebaseAuthAdapter({
      config: {
         /* Firebase config */
      },
   })
)

// Register user
const user = await Auth.register({
   email: 'user@example.com',
   password: 'securepassword',
   firstname: 'John',
   lastname: 'Doe',
})

// Authenticate
const token = await Auth.login('user@example.com', 'securepassword')
```

### @quatrain/storage

**File storage abstractions for various cloud providers**

-  **File Operations**: Upload, download, copy, move, delete
-  **Stream Support**: Efficient handling of large files
-  **Metadata Management**: File type detection and custom metadata

```typescript
import { Storage } from '@quatrain/storage'
import { S3StorageAdapter } from '@quatrain/storage-s3'

// Setup storage
Storage.addAdapter(
   new S3StorageAdapter({
      config: {
         accessKeyId: 'your-key',
         secretAccessKey: 'your-secret',
         region: 'us-east-1',
         endpoint: 'https://s3.amazonaws.com',
      },
   })
)

// Upload file
const file = await Storage.create({
   name: 'document.pdf',
   path: 'documents/',
   buffer: fileBuffer,
   contentType: 'application/pdf',
})

// Download file
const downloadedFile = await Storage.read('documents/document.pdf')
```

### @quatrain/queue

**Message queue abstractions for asynchronous processing**

-  **Multiple Providers**: AMQP, AWS SQS, GCP Pub/Sub
-  **Message Publishing**: Send messages to queues/topics
-  **Worker Patterns**: Background job processing

```typescript
import { Queue } from '@quatrain/queue'
import { AmqpQueueAdapter } from '@quatrain/queue-amqp'

// Setup queue
Queue.addAdapter(
   new AmqpQueueAdapter({
      connectionString: 'amqp://localhost:5672',
   })
)

// Send message
await Queue.publish('email-queue', {
   to: 'user@example.com',
   subject: 'Welcome!',
   template: 'welcome',
})

// Process messages
Queue.subscribe('email-queue', async (message) => {
   await emailService.send(message.data)
})
```

### @quatrain/log

**Structured logging for applications**

-  **Multiple Log Levels**: DEBUG, INFO, WARN, ERROR
-  **Adapter Pattern**: Pluggable logging backends
-  **Domain-specific Loggers**: Separate loggers for different components

```typescript
import { Log, LogLevel } from '@quatrain/log'

// Setup logging
const logger = Log.addLogger('myapp', new ConsoleLoggerAdapter(), true)
logger.setLogLevel(LogLevel.INFO)

// Log messages
logger.info('Application started')
logger.warn('Low disk space')
logger.error('Database connection failed')
```

## 🔌 Backend Adapters

### @quatrain/backend-postgres

**PostgreSQL adapter with full SQL support**

```typescript
import { PostgresAdapter } from '@quatrain/backend-postgres'

const adapter = new PostgresAdapter({
   config: {
      host: 'localhost',
      port: 5432,
      database: 'myapp',
      user: 'postgres',
      password: 'password',
   },
})

// Setup database schema (see DATABASE_SETUP.md)
// Supports complex queries, transactions, and PostgreSQL-specific features
```

### @quatrain/backend-firestore

**Google Firestore NoSQL adapter**

```typescript
import { FirestoreAdapter } from '@quatrain/backend-firestore'

const adapter = new FirestoreAdapter({
   config: {
      projectId: 'my-firebase-project',
      keyFilename: './service-account-key.json',
   },
})

// Automatic subcollection handling and Firestore-optimized queries
```

### @quatrain/backend-sqlite

**SQLite adapter for local development and testing**

```typescript
import { SQLiteAdapter } from '@quatrain/backend-sqlite'

const adapter = new SQLiteAdapter({
   config: {
      filename: './data.sqlite',
   },
})

// Perfect for development, testing, and small applications
```

## 🔐 BaaS Authentication Adapters

### @quatrain/auth-firebase

**Firebase Authentication - Google's managed auth service**

```typescript
import { FirebaseAuthAdapter } from '@quatrain/auth-firebase'

const authAdapter = new FirebaseAuthAdapter({
   config: {
      apiKey: 'your-api-key',
      authDomain: 'project.firebaseapp.com',
   },
})

// Supports email/password, social logins, custom tokens
```

### @quatrain/auth-supabase

**Supabase Authentication - open-source Firebase alternative with deployment flexibility**

```typescript
import { SupabaseAuthAdapter } from '@quatrain/auth-supabase'

// Works with Supabase SaaS
const authAdapter = new SupabaseAuthAdapter({
   config: {
      url: 'https://project.supabase.co',
      anonKey: 'your-anon-key',
   },
})

// Or self-hosted Supabase (Docker/Kubernetes)
const selfHostedAuth = new SupabaseAuthAdapter({
   config: {
      url: 'https://your-domain.com', // Your self-hosted instance
      anonKey: 'your-anon-key',
   },
})

// Row-level security and Postgres-backed authentication
// Works identically whether SaaS or self-hosted
```

## 📁 BaaS Storage Adapters

### @quatrain/storage-s3

**AWS S3 and S3-compatible storage**

```typescript
import { S3StorageAdapter } from '@quatrain/storage-s3'

const storageAdapter = new S3StorageAdapter({
   config: {
      accessKeyId: 'your-key',
      secretAccessKey: 'your-secret',
      region: 'us-east-1',
   },
})

// Works with AWS S3, MinIO, DigitalOcean Spaces, etc.
```

### @quatrain/storage-firebase

**Firebase Cloud Storage - Google's managed file storage**

```typescript
import { FirebaseStorageAdapter } from '@quatrain/storage-firebase'

const storageAdapter = new FirebaseStorageAdapter({
   config: {
      /* Firebase config */
   },
})

// Integrated with Firebase security rules and authentication
// Automatic CDN distribution and image transformations
```

### @quatrain/storage-supabase

**Supabase Storage - S3-compatible with deployment flexibility**

```typescript
import { SupabaseStorageAdapter } from '@quatrain/storage-supabase'

// Works with Supabase SaaS or self-hosted
const storageAdapter = new SupabaseStorageAdapter({
   config: {
      url: 'https://project.supabase.co', // or your self-hosted URL
      anonKey: 'your-anon-key',
   },
})

// Row-level security policies for files
// Compatible with any S3-compatible backend when self-hosted
```

## 📬 Queue Adapters

### @quatrain/queue-amqp

**RabbitMQ and AMQP-compatible message brokers**

```typescript
import { AmqpQueueAdapter } from '@quatrain/queue-amqp'

const queueAdapter = new AmqpQueueAdapter({
   connectionString: 'amqp://user:pass@localhost:5672',
})
```

### @quatrain/queue-aws

**AWS SQS message queuing**

```typescript
import { SqsAdapter } from '@quatrain/queue-aws'

const queueAdapter = new SqsAdapter({
   region: 'us-east-1',
   credentials: {
      /* AWS credentials */
   },
})
```

## 🎯 Why Backend as a Service?

Quatrain Core embraces the **BaaS philosophy** to accelerate development:

### ✅ Benefits of BaaS with Quatrain

-  **🚀 Rapid Development**: Skip infrastructure setup, focus on business logic
-  **🔒 Built-in Security**: Authentication, authorization, and data validation out-of-the-box
-  **📊 Real-time Features**: Live data synchronization without complex WebSocket setup
-  **📱 Multi-platform**: Same backend for web, mobile, and desktop applications
-  **🌍 Global Scale**: CDN, edge functions, and global data distribution included
-  **💰 Cost-effective**: Pay-as-you-scale pricing models
-  **🔧 DevOps-free**: No servers to maintain, automatic scaling and backups

### 🏢 Deployment Flexibility (Supabase Example)

```typescript
// Same code works across all deployment models:

// 1. SaaS (Managed by Supabase)
const saasConfig = {
   url: 'https://xyz.supabase.co',
   anonKey: 'eyJ...',
}

// 2. Self-hosted (Docker Compose)
const dockerConfig = {
   url: 'http://localhost:8000',
   anonKey: 'eyJ...',
}

// 3. Kubernetes deployment
const k8sConfig = {
   url: 'https://supabase.yourcompany.com',
   anonKey: 'eyJ...',
}

// Same Quatrain code, different deployment targets
const adapter = new SupabaseAuthAdapter({ config: saasConfig })
```

## 🚀 Quick Start Example

Here's a complete example showing how to build a simple blog application:

```typescript
// 1. Install packages
// yarn add @quatrain/core @quatrain/backend @quatrain/backend-postgres

// 2. Setup
import { BaseObject, StringProperty, DateTimeProperty } from '@quatrain/core'
import { Backend, User } from '@quatrain/backend'
import { PostgresAdapter } from '@quatrain/backend-postgres'

// 3. Define models
class BlogPost extends BaseObject {
   static COLLECTION = 'posts'
   static PROPS_DEFINITION = [
      ...BaseObjectProperties, // Includes name, status, audit fields
      {
         name: 'title',
         type: StringProperty.TYPE,
         mandatory: true,
         maxLength: 200,
      },
      {
         name: 'content',
         type: StringProperty.TYPE,
         mandatory: true,
      },
      {
         name: 'author',
         type: ObjectProperty.TYPE,
         instanceOf: 'User',
         mandatory: true,
      },
      {
         name: 'publishedAt',
         type: DateTimeProperty.TYPE,
      },
   ]
}

// 4. Setup backend
const backend = new PostgresAdapter({
   config: {
      host: 'localhost',
      database: 'blog',
      user: 'postgres',
      password: 'password',
   },
})

Backend.addAdapter(backend, 'default')

// 5. Create and save a blog post
const author = await User.factory()
author._.firstname = 'Jane'
author._.lastname = 'Doe'
author._.email = 'jane@example.com'
await backend.create(author.dataObject)

const post = await BlogPost.factory()
post._.title = 'My First Post'
post._.content = 'This is the content of my first blog post...'
post._.author = author
post._.publishedAt = new Date()
await backend.create(post.dataObject)

// 6. Query posts
const posts = await backend.find(
   BlogPost.factory(),
   [new Filter('status', 'active', OperatorKeys.equals)],
   {
      limits: { batch: 10, offset: 0 },
      sortings: [{ prop: 'publishedAt', order: 'DESC' }],
   }
)
```

## 🧪 Testing

All packages include comprehensive test suites. Use the provided test utilities:

```typescript
// Testing with mock adapter
import { MockAdapter } from '@quatrain/backend'

const mockBackend = new MockAdapter()
// Mock backend stores data in memory - perfect for unit tests

// Testing with real databases
// Each adapter package includes test schemas and setup instructions
```

## 📚 Documentation

-  Each package includes detailed README files
-  API documentation generated from TypeScript definitions
-  Example implementations in `__test__` directories
-  Database setup guides (e.g., `DATABASE_SETUP.md` for PostgreSQL)
-  **⚠️ Architectural Rules & Pitfalls:** Be sure to read [ARCHITECTURE_GUIDELINES.md](./ARCHITECTURE_GUIDELINES.md) to understand Quatrain's specific conventions (e.g., `fromBackend` vs `factory`, properties definitions, soft deletion).

## 🤝 Contributing

The framework follows a consistent pattern across all packages:

1. **Abstract base classes** define interfaces
2. **Concrete adapters** implement specific providers
3. **Comprehensive testing** with both unit and integration tests
4. **TypeScript-first** with full type safety
5. **Modular design** - use only what you need

## 📄 License

AGPL v3 License - See individual package.json files for details.

---

**Quatrain Développement SAS** - Building robust business applications with clean architecture.
