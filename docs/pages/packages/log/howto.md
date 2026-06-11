# How To: Using @quatrain/log

This guide demonstrates how to effectively utilize the `@quatrain/log` package across your applications, from simple logging to complex, multi-logger setups.

## Table of Contents
1. [Basic Logging](#1-basic-logging)
2. [Setting Log Levels](#2-setting-log-levels)
3. [Creating Specialized Loggers](#3-creating-specialized-loggers)
4. [Custom Logger Adapters](#4-custom-logger-adapters)

---

## 1. Basic Logging

The simplest way to use the package is via the static methods on the `Log` class. It behaves similarly to the native `console`, but with better formatting and timestamping.

```typescript
import { Log } from '@quatrain/log'

// Standard informational message
Log.info('Application started successfully')

// Debugging data
Log.debug('Current user context:', { id: 123, role: 'admin' })

// Warnings and Errors
Log.warn('Rate limit approaching')
Log.error('Failed to connect to database', new Error('Connection timeout'))

// Deep tracing (often ignored unless LogLevel is set to TRACE)
Log.trace('Entering function ProcessData() with args', args)
```

## 2. Setting Log Levels

You can filter which logs are displayed by adjusting the `LogLevel`. The hierarchy is:
`TRACE` < `DEBUG` < `INFO` < `WARN` < `ERROR` < `SILENT`

If you set the level to `INFO`, both `TRACE` and `DEBUG` messages will be ignored.

```typescript
import { Log, LogLevel } from '@quatrain/log'

// Retrieve the default logger and configure it
const defaultLogger = Log.getLogger()

// In production, you might only want warnings and errors
defaultLogger.setLevel(LogLevel.WARN)

Log.info('This will NOT be printed')
Log.error('This WILL be printed')
```

## 3. Creating Specialized Loggers

In larger applications, it's beneficial to have separate loggers for different subsystems (e.g., Database, API, Queue). This allows you to visually distinguish logs and change verbosity per subsystem.

```typescript
import { Log, DefaultLoggerAdapter, LogLevel } from '@quatrain/log'

// 1. Create and register a new logger with a specific alias
const dbLogger = new DefaultLoggerAdapter()
dbLogger.setLevel(LogLevel.DEBUG)

Log.addLogger('Database', dbLogger)

// 2. Use the specialized logger by cloning it or calling it directly
// Cloning allows prefixing logs automatically
const queryLogger = Log.getLogger('Database').clone('SQL')

queryLogger.info('Connected to PostgreSQL') 
// Output: [Date] [INFO] [SQL] Connected to PostgreSQL

queryLogger.debug('Executing SELECT * FROM users') 
// Output: [Date] [DEBUG] [SQL] Executing SELECT * FROM users
```

## 4. Custom Logger Adapters

If you need to send logs to an external service (like Datadog, Sentry, or a file), you can extend `AbstractLoggerAdapter`.

```typescript
import { AbstractLoggerAdapter, LogLevel } from '@quatrain/log'

export class FileLoggerAdapter extends AbstractLoggerAdapter {
    
    log(...messages: any[]): void {
        if (this._level > LogLevel.INFO) return;
        this.writeToFile('INFO', messages);
    }
    
    error(...messages: any[]): void {
        if (this._level > LogLevel.ERROR) return;
        this.writeToFile('ERROR', messages);
    }
    
    // Implement other abstract methods (debug, warn, etc.)
    // ...

    private writeToFile(level: string, messages: any[]) {
        const timestamp = new Date().toISOString();
        const prefix = this._alias ? `[${this._alias}]` : '';
        const logLine = `${timestamp} [${level}] ${prefix} ${messages.join(' ')}\n`;
        
        // fs.appendFileSync('app.log', logLine);
    }
}

// Usage
import { Log } from '@quatrain/log'

Log.addLogger('FileDump', new FileLoggerAdapter())
Log.getLogger('FileDump').error('Critical crash!')
```
