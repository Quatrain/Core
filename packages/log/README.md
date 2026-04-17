# @quatrain/log

A structured logging package for Quatrain applications. It uses an adapter pattern to allow for different logging backends, such as the console, file, or a cloud logging service.

## Features

-  **Multiple Log Levels**: Supports `DEBUG`, `INFO`, `WARN`, `ERROR`, and `CRITICAL`.
-  **Adapter Pattern**: Pluggable adapters for various logging outputs.
-  **Domain-specific Loggers**: Create separate logger instances for different parts of your application.
-  **Structured JSON Output**: Logs can be formatted as JSON for easy parsing by log management systems.

## Installation

```bash
npm install @quatrain/log
```

## Usage

```typescript
import { Log, LogLevel } from '@quatrain/log'
import { ConsoleLoggerAdapter } from '@quatrain/log' // Example adapter

const logger = Log.addLogger('api', new ConsoleLoggerAdapter(), true)
logger.info('Server has started.', { port: 3000 })

// Instantiating a sub-logger using clone()
const subLogger = logger.clone('db') // Inherits configuration, suffixing prefix with ][db
subLogger.debug('Connection pool initialized.') // Output prefix: [api][db]
```
