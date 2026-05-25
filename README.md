<div align="center">
  <img src="./assets/logo.png" alt="Core Logo" width="300" />
</div>

# Core - A Modular & Universal Backend Framework

> **"Business Logic outlives Infrastructure"**

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Quatrain_Core&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Quatrain_Core)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Quatrain_Core&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Quatrain_Core)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=Quatrain_Core&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=Quatrain_Core)

Core (a product of Quatrain) is a modular TypeScript framework designed to accelerate business application development. Built upon a powerful **Adapter Pattern**, it decouples your core business logic from the underlying infrastructure, allowing you to deploy **100% on-premise** with standard open-source blocks, leverage modern **Backend as a Service (BaaS)** platforms (like Supabase and Firebase), or run a **hybrid** architecture.

---

## 🎯 Core Principles

- **BaaS & On-Premise Synergy**: Build modern cloud-native apps leveraging managed services like Firebase/Supabase, or target strict data-sovereign environments using traditional self-hosted infrastructure (PostgreSQL, SQLite, S3, OIDC/OAuth, RabbitMQ). The exact same codebase runs in both worlds.
- **Clean Abstraction**: Write your business logic once. Decouple your models and processes from transport layers, databases, file storages, or messaging brokers.
- **No Vendor Lock-In**: Seamlessly swap database engines (SQLite, PostgreSQL, Firestore), auth providers (Supabase Auth, Firebase Auth, OIDC/OAuth, Basic Auth), object storage backends (Local FileSystem, AWS S3, MinIO), or message queues (AMQP/RabbitMQ, AWS SQS, GCP Pub/Sub) via simple configuration changes.
- **Modular by Design**: The framework is split into clean, highly factorized packages. Use only the bricks you need, from core object validation to authentication, storage, and pub/sub queues.
- **Standalone Core**: The `@quatrain/core` package works entirely in-memory for defining models, validation, and business logic, without requiring any database or network connection.

---

## 🧠 Philosophy

Core is built upon three foundational pillars to ensure enterprise-grade reliability and longevity:

- **Sovereignty by Design**: Deploy anywhere, from your local laptop to the largest hyperscalers (AWS, GCP, Azure). Core's adapter pattern prevents vendor lock-in, ensuring you retain total control over your data and infrastructure choices.
- **Cybersecurity by Design**: We rely on rock-solid, audited, and widely adopted components. By keeping the core architecture simple and maintainable, we reduce the attack surface and make security patching straightforward.
- **Cloud-Native Best Practices**: Designed to build robust applications that withstand the test of time. Core embraces stateless execution, ephemeral environments, and seamless horizontal scaling to effortlessly adapt to technological innovations.

---

## 📐 1. Design

The Design phase is all about modeling your domain and laying the foundations of your application without worrying about the underlying database or UI framework logic.

### Core Ecosystem
- **`@quatrain/core`**: Foundation package. Works standalone in-memory. Defines models, properties, validation, and serialization.
- **`@quatrain/types`**: Shared contracts, types, interfaces, and exceptions for Core.
- **`@quatrain/studio`**: Visual interface and meta-modeling package used by the visual studio application.
- **`@quatrain/ui`**: Core styling and component logic (Mantine-based) for consistent frontend experiences.

> [!TIP]
> For complete documentation, modeling details, and quick-start tutorials on these packages, please refer to the **[Core Wiki](https://github.com/Quatrain/Core/wiki)**.

---

## 🛠️ 2. Development

During Development, you connect your business logic to services such as databases, authentication, AI, and message queues, using interchangeable adapters.

### Backend & Service Ecosystem
- **Database Adapters**: `@quatrain/backend`, `@quatrain/backend-firestore`, `@quatrain/backend-postgres`, `@quatrain/backend-sqlite`
- **Authentication**: `@quatrain/auth`, `@quatrain/auth-firebase`, `@quatrain/auth-supabase`, `@quatrain/auth-oidc`, `@quatrain/auth-pocketbase`
- **Storage**: `@quatrain/storage`, `@quatrain/storage-firebase`, `@quatrain/storage-supabase`, `@quatrain/storage-local`, `@quatrain/storage-s3`
- **Queueing & Messaging**: `@quatrain/queue`, `@quatrain/queue-amqp`, `@quatrain/queue-aws`, `@quatrain/queue-gcp`, `@quatrain/messaging`, `@quatrain/messaging-firebase`
- **AI & Automation**: `@quatrain/ai`, `@quatrain/ai-gemini`, `@quatrain/app`, `@quatrain/code`, `@quatrain/code-github`
- **Testing**: `@quatrain/testing`

> [!TIP]
> For full code persistence examples, dependency injection setups, and service integrations, visit the **[Core Wiki](https://github.com/Quatrain/Core/wiki)**.

---

## 🚀 3. Deployment

Deployment covers running your code, scaffolding new environments, configuring API gateways, and handling data migrations. 

### Deployment & Infrastructure Ecosystem
- **CLI & Code Generation**: `@quatrain/core-cli` (Scaffolds projects, configurations, and migrations)
- **Migrations**: `@quatrain/backend-migrations` (Schema and data migration tooling)
- **Cloud Wrappers**: `@quatrain/cloudwrapper`, `@quatrain/cloudwrapper-firebase`, `@quatrain/cloudwrapper-supabase` (Serverless/Edge functions handling)

### Ready-To-Use Applications & Containers

All deployable applications, live modeling portals, gateway proxies, and pre-built deployment setups are organized in the dedicated companion repository:

👉 **[CoreApps Repository](https://github.com/Quatrain/CoreApps)**

Here you will find ready-to-use Docker/Podman container images and configurations:
- **`api-gateway`**: Ultra-lightweight Express-based reverse proxy routing requests to your upstream services.
- **`studio-image`**: Pre-configured environment hosting the Visual Developer Studio Dashboard.

---

## 🔮 Upcoming

The Core ecosystem is constantly evolving to empower developers and business users alike. Our roadmap includes:

- **Studio**: A complete, visual interface to design and manage your entire application ecosystem. This studio will be driven by the user and seamlessly assisted by a Large Language Model (LLM) to accelerate scaffolding, modeling, and repetitive tasks.
- **BPM & State Machines**: A powerful Business Process Management (BPM) engine allowing you to manage complex business logic and entity lifecycles through robust, visual "State Machines".

---

## ⚖️ License & Professional Services

Core is released under the **AGPL-3.0** (Affero General Public License). This ensures that any enhancements to the open-source core remain free and accessible to the community. If you build a SaaS or application using this framework, you must comply with the AGPL-3.0 terms.

**Professional Services & Commercial Licensing**  
If your organization requires a commercial license (to integrate Core without the AGPL-3.0 restrictions), or if you need expert assistance, the **Quatrain** team offers:
- **Commercial Licensing**: Tailored licenses for proprietary software and enterprise deployments.
- **Custom Development**: Expert engineers to help you build or migrate your backend architecture.
- **Premium Support**: Priority SLA, architectural consulting, and code reviews.

Contact us at **developers@quatrain.com** to discuss your project needs.
