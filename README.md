<div align="center">
  <img src="./assets/logo.png" alt="Quatrain Core Logo" width="280" />
  <h1>Quatrain Core</h1>
  <p><strong>A Modular, Sovereign & Universal TypeScript Backend Framework</strong></p>
  <p><em>"Business Logic outlives Infrastructure"</em></p>

  [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Quatrain_Core&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Quatrain_Core)
  [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Quatrain_Core&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Quatrain_Core)
  [![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=Quatrain_Core&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=Quatrain_Core)
  [![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE.md)
  [![Monorepo Packages](https://img.shields.io/badge/packages-71%20active-success.svg)](#-ecosystem--packages-map)
</div>

---

## 🌟 At a Glance

**Quatrain Core** is an enterprise-grade, modular TypeScript framework designed to build resilient, cloud-agnostic applications. Built around the **Hexagonal / Adapter Pattern**, it completely decouples domain modeling and business rules from the underlying infrastructure.

Write your domain logic once, then seamlessly swap or mix:
* **Databases**: PostgreSQL, SQLite, Firestore, or REST backends.
* **Authentication**: Supabase Auth, Firebase Auth, OIDC / OAuth2, PocketBase, or HTTP Basic.
* **Storage**: AWS S3, MinIO, Local Filesystem, Google Cloud Storage, or Git.
* **Queuing & Messaging**: RabbitMQ (AMQP), MQTT, SQLite queues, AWS SQS, or GCP Pub/Sub.

Target **100% on-premise sovereign setups** or modern **Backend-as-a-Service (BaaS) cloud platforms** with the exact same codebase.

---

## 📚 Table of Contents

- [Core Principles](#-core-principles)
- [Quick Start](#-quick-start)
- [Ecosystem & Packages Map](#-ecosystem--packages-map)
- [Documentation & API Reference](#-documentation--api-reference)
- [Open Knowledge Base (OKF) & Tycho](#-open-knowledge-base-okf-v01--tycho-integration)
- [Companion Projects](#-companion-projects)
- [Monorepo Development](#-monorepo-development)
- [License & Support](#-license--support)

---

## 🎯 Core Principles

1. **Clean Hexagonal Abstraction**: Entities, validation rules, and business logic live in `@quatrain/core` with zero external dependencies. They remain fully testable in-memory.
2. **True Sovereignty & Zero Vendor Lock-In**: Avoid proprietary traps. You can run your stack on self-hosted bare metal (PostgreSQL + RabbitMQ + S3-compatible storage) or managed cloud platforms with a single configuration line.
3. **Zero-Boilerplate Active Record & Repositories**: Every entity provides dynamic, strongly-typed repositories with built-in schema validation, serialization, relationships, and aggregations (`sum`, `count`, `avg`, `min`, `max`).
4. **Fine-Grained Modularity**: A factorized monorepo of **71 independent packages**. Import only what your service needs to keep production bundles light.

---

## 🚀 Quick Start

### 1. Install Dependencies

Install the core modeling engine and the backend adapter of your choice:

```bash
# Using Yarn
yarn add @quatrain/core @quatrain/backend @quatrain/backend-postgres

# Using npm
npm install @quatrain/core @quatrain/backend @quatrain/backend-postgres
```

### 2. Define a Domain Model

Define entity attributes, types, and validation rules declaratively:

```typescript
import { PersistedBaseObject } from '@quatrain/backend'
import { StringProperty, NumberProperty, BooleanProperty } from '@quatrain/core'

export class Product extends PersistedBaseObject {
  static COLLECTION = 'products'

  static PROPS_DEFINITION = [
    { name: 'name', type: StringProperty.TYPE, required: true },
    { name: 'sku', type: StringProperty.TYPE, required: true },
    { name: 'price', type: NumberProperty.TYPE, required: true },
    { name: 'inStock', type: BooleanProperty.TYPE, default: true }
  ]
}
```

### 3. Connect Adapter & Persist Data

Configure the backend adapter and perform operations through pre-bound repositories:

```typescript
import { Backend } from '@quatrain/backend'
import { PostgresAdapter } from '@quatrain/backend-postgres'
import { Product } from './models/Product'

async function bootstrap() {
  // 1. Initialize and register the backend adapter
  const postgres = new PostgresAdapter({
    config: {
      host: process.env.PG_HOST || 'localhost',
      port: 5432,
      database: 'quatrain_db',
      user: 'postgres',
      password: process.env.PG_PASSWORD || 'secret'
    }
  })
  Backend.addBackend(postgres, 'postgres', true)

  // 2. Instantiate and persist through dynamic repository
  const repo = Product.repository()
  const item = await Product.factory({
    name: 'prod_900',
    sku: 'SKU-QUATRAIN-01',
    price: 49.99,
    inStock: true
  })
  await repo.create(item)

  // 3. Read by UID
  const loaded = await repo.read('prod_900')
  console.log(`Product loaded: ${loaded?.val('sku')}`)
}

bootstrap()
```

---

## 📦 Ecosystem & Packages Map

The framework is organized into 7 logical architectural layers across 71 packages:

| Layer | Core Package | Ecosystem Adapters & Modules |
| :--- | :--- | :--- |
| **Domain & Entities** | [`@quatrain/core`](packages/core) | [`@quatrain/types`](packages/types) · [`@quatrain/state-machine`](packages/state-machine) · [`@quatrain/okf`](packages/okf) |
| **Databases & Persistence** | [`@quatrain/backend`](packages/backend) | [`backend-postgres`](packages/backend-postgres) · [`backend-sqlite`](packages/backend-sqlite) · [`backend-firestore`](packages/backend-firestore) · [`backend-restapi`](packages/backend-restapi) · [`backend-migrations`](packages/backend-migrations) |
| **Authentication & RBAC** | [`@quatrain/auth`](packages/auth) | [`auth-rbac`](packages/auth-rbac) · [`auth-supabase`](packages/auth-supabase) · [`auth-firebase`](packages/auth-firebase) · [`auth-oidc`](packages/auth-oidc) · [`auth-pocketbase`](packages/auth-pocketbase) · [`auth-http-basic`](packages/auth-http-basic) |
| **Object Storage** | [`@quatrain/storage`](packages/storage) | [`storage-s3`](packages/storage-s3) · [`storage-local`](packages/storage-local) · [`storage-supabase`](packages/storage-supabase) · [`storage-firebase`](packages/storage-firebase) · [`storage-git`](packages/storage-git) |
| **Queues & Messaging** | [`@quatrain/queue`](packages/queue) | [`queue-amqp`](packages/queue-amqp) · [`queue-mqtt`](packages/queue-mqtt) · [`queue-sqlite`](packages/queue-sqlite) · [`queue-aws`](packages/queue-aws) · [`queue-gcp`](packages/queue-gcp) · [`messaging`](packages/messaging) |
| **APIs & Gateways** | [`@quatrain/api`](packages/api) | [`api-client`](packages/api-client) · [`api-server`](packages/api-server) · [`api-server-express`](packages/api-server-express) · [`api-server-astro`](packages/api-server-astro) · [`api-xmlrpc`](packages/api-xmlrpc) |
| **AI, Chat & Cognitive** | [`@quatrain/ai`](packages/ai) | [`ai-gemini`](packages/ai-gemini) · [`chat`](packages/chat) · [`skills`](packages/skills) |
| **Platform & Tooling** | [`@quatrain/cli`](packages/cli) | [`cache`](packages/cache) · [`cache-redis`](packages/cache-redis) · [`log`](packages/log) · [`i18n`](packages/i18n) · [`mdm`](packages/mdm) · [`testing`](packages/testing) |

👉 **[Explore Full Interactive Packages Catalog](https://apps.quatrain.dev/packages)**

---

## 📖 Documentation & API Reference

* 🌐 **Documentation Portal**: Complete guides, HOWTOs, and architecture standards: [apps.quatrain.dev](https://apps.quatrain.dev)
* 📦 **Full API Reference**: Automatically extracted TypeScript documentation (classes, interfaces, signatures): [apps.quatrain.dev/api-reference/modules.html](https://apps.quatrain.dev/api-reference/modules.html)
* 📑 **Package Guides**: Each package maintains an `Overview` (`README.md`) and practical recipes (`HOWTO.md`) inside its folder.

---

## 🧠 Open Knowledge Base (OKF v0.1) & Tycho Integration

Quatrain Core embeds an official knowledge base formatted according to the **Open Knowledge Format (OKF v0.1)** directly under [`okf/`](okf/index.md).

Designed specifically for **AI pair-programming agents** (Gemini, Claude, Antigravity, Cursor) and human engineers, it provides authoritative, hallucination-free guidance across 8 core architectural pillars:
* 🏛️ **Domain Modeling**: [`okf/domain-modeling/`](okf/domain-modeling/index.md) (Schemas, `.TYPE`, `._` proxy, FSM workflows)
* 💾 **Persistence**: [`okf/persistence-adapters/`](okf/persistence-adapters/index.md) (Repositories, PostgreSQL, SQLite, Migrations)
* 🔐 **Auth & Security**: [`okf/auth-and-security/`](okf/auth-and-security/index.md) (SSO, Supabase, RBAC, Field-Level Security)
* 🗄️ **Object Storage**: [`okf/storage-and-assets/`](okf/storage-and-assets/index.md) (Unified S3/MinIO & Local FS storage)
* 📬 **Queues & Streaming**: [`okf/queues-and-events/`](okf/queues-and-events/index.md) (RabbitMQ/AMQP, background workers)
* 🌐 **API Gateways**: [`okf/api-and-gateways/`](okf/api-and-gateways/index.md) (Isomorphic fetch client, CrudEndpoint)
* 🤖 **AI Agents**: [`okf/ai-and-agents/`](okf/ai-and-agents/index.md) (Gemini models, schema-guaranteed JSON generation)

### Annexing via Tycho CLI (`tycho knowledge`)

You can directly annex this knowledge base into your personal or team agent configuration (such as `AGENTS.okf`) using **Tycho**:

```bash
# 1. Register the Quatrain Core repository in Tycho
tycho repo add quatrain Quatrain/Core

# 2. Install the knowledge package
tycho knowledge install quatrain/quatrain-core

# 3. Check active knowledge packages
tycho knowledge list
```

The automated post-install hook (`.tycho/knowledge/quatrain-core/post-install.sh`) links the `okf/` directory into your active agent knowledge router and triggers an immediate router build (`bun run build && bun run sync:local`).

---

## 🧰 Companion Projects

* **[Quatrain CoreApps](https://github.com/Quatrain/CoreApps)**: Pre-packaged Docker / Podman containers, including:
  * `api-gateway`: High-performance reverse proxy and routing gateway.
  * `studio-image`: Web modeling studio for entity scaffolding.
* **[Quatrain CoreUX](https://github.com/Quatrain/CoreUX)**: Mantine-based UI design tokens, components, high-contrast mobile interfaces, and voice adapters.

---

## 💻 Monorepo Development

### Prerequisites
* **Node.js**: `>= 22.0.0`
* **Package Manager**: Yarn v4 (`corepack enable`)

### Setup & Verification Commands

```bash
# 1. Install all monorepo dependencies
yarn install

# 2. Build all workspaces via Turborepo
yarn build

# 3. Run full test suite across packages
yarn test

# 4. Generate documentation & TypeDoc API reference
yarn ts-node scripts/build-docs.ts

# 5. Start documentation development server
yarn --cwd docs dev
```

### Contribution & GitFlow Protocol
* Active integration branch: `develop`
* Topic branches: `feat/<issue-id>-<description>` or `fix/<issue-id>-<description>` branched strictly from `develop`.
* Commit standard: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
* Pull Requests must target `--base develop`.

---

## ⚖️ License & Professional Services

Quatrain Core is licensed under the **AGPL-3.0** (Affero General Public License). Any enhancements to the open-source core remain free and accessible to the community.

### Enterprise Services & Commercial Licensing
If your organization requires a commercial license (to embed Core into closed-source commercial offerings), or if you need enterprise consulting:

* 💼 **Commercial Licensing**: Custom terms without AGPL copyleft obligations.
* 🛠️ **Architecture Consulting & Migration**: Expert engineering assistance to scaffold and deploy sovereign backends.
* ⚡ **Enterprise Support**: Dedicated SLA, priority issue triage, and security reviews.

📧 Contact the Quatrain team at **[developers@quatrain.com](mailto:developers@quatrain.com)**.
