# @quatrain/log

A centralized logging system for Quatrain applications, providing flexible log levels, adapter-based outputs, and structured logging capabilities.

## Introduction

The `@quatrain/log` package acts as the unified logging interface for all components within the Quatrain ecosystem. Rather than scattering `console.log` statements throughout your code, this package offers a structured approach to debugging, warning, and tracing errors, with the ability to route logs to different destinations via custom adapters.

## Key Concepts

- **`Log`**: The static registry and main interface for logging messages.
- **`LogLevel`**: Enum defining severity (`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `SILENT`).
- **`AbstractLoggerAdapter`**: The base class for creating custom log outputs.
- **`DefaultLoggerAdapter`**: The built-in adapter that outputs colorized logs to the console using `chalk`.

## Installation

```bash
npm install @quatrain/log
# or
yarn add @quatrain/log
# or
bun add @quatrain/log
```

## Configuration

By default, `@quatrain/log` initializes a `DefaultLoggerAdapter` with the `INFO` level. 
No configuration is required for basic usage.

If you need to change the log level globally or register custom loggers, you can do so early in your application lifecycle:

```typescript
import { Log, LogLevel } from '@quatrain/log'

// Set the default logger level to DEBUG
Log.getLogger().setLevel(LogLevel.DEBUG)
```

## License

AGPL-3.0-only
