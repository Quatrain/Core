# @quatrain/config

Multi-source configuration manager and registry for Quatrain applications and
autonomous agent tools.

Provides seamless, zero-dependency configuration management featuring:

-  **Central Registry Pattern**: Multi-tool isolation mirroring `Backend`,
   `Storage`, and `Log`.
-  **Fail-Fast Validation**: Immediate `ConfigurationError` when critical
   parameters or API credentials are missing or blank.
-  **Multi-Source Resolution**: Hierarchical priority cascading (`Memory` >
   `Environment` > `Object` / `JSON`).
-  **Sub-Scoping & Dot Notation**: Clean delegation across namespaces
   (e.g., `Config.scope('odoo').requireString('apiKey')`).

## Installation

```bash
yarn add @quatrain/config
```

## Usage

### 1. Isolated Tool Configurations (Agent Gateway & Multi-Tool)

Register independent configurations for distinct third-party tools or external
services without namespace collision:

```typescript
import { Config } from '@quatrain/config'

// Register tool credentials
Config.addConfig('odoo', {
  url: 'https://erp.example.com',
  database: 'production',
  apiKey: 'odoo-secret-key',
})

Config.addConfig('google-drive', {
  clientId: 'gdrive-client-id',
  clientSecret: 'gdrive-client-secret',
})

// Retrieve tool configurations safely
const odoo = Config.getConfig('odoo')
const odooUrl = odoo.requireString('url')
const apiKey = odoo.requireString('apiKey')

// Scoped access
const gdrive = Config.scope('google-drive')
const clientId = gdrive.requireString('clientId')
```

### 2. Global Default Configuration & Fail-Fast Helpers

Use the global default container for application runtime variables:

```typescript
import { Config } from '@quatrain/config'

// Sets or overrides values in the in-memory store
Config.set('server.port', 3000)
Config.set('server.host', '0.0.0.0')

// Strict fail-fast access (throws ConfigurationError if missing)
const port = Config.requireNumber('server.port')
const host = Config.requireString('server.host')
const secret = Config.requireString(
  'JWT_SECRET',
  'Set JWT_SECRET in your environment or .env file',
)

// Optional values with fallbacks
const logLevel = Config.getString('LOG_LEVEL', 'info')
```

### 3. Multi-Source Priority & Environment Mapping

`ConfigContainer` resolves parameters across registered sources by descending
priority:

1.  **MemoryConfigSource** (Priority: 100) — Runtime programmatic overrides.
2.  **EnvConfigSource** (Priority: 50) — Process environment variables,
    supporting automatic UPPER_SNAKE_CASE mapping (`database.host` ->
    `DATABASE_HOST`).
3.  **ObjectConfigSource** (Priority: 10) — Structured JavaScript objects or
    parsed JSON files.

```typescript
import { Config, ObjectConfigSource, EnvConfigSource } from '@quatrain/config'

const container = Config.getConfig()
container.addSource(new ObjectConfigSource({ title: 'Default Title' }))
```

## License

AGPL-3.0-only © Quatrain Développement SAS
