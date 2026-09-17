# LLM Agent Instructions & Guidelines — Quatrain Core

> **Audience**: AI Coding Agents & Human Pair Programming  
> **Platform**: Monorepo TypeScript (Yarn 4 / Node 22) + Hexagonal Architecture + OKF v0.1 + Tycho  
> **Upstream Canonical Repository (SOA)**: `https://github.com/Quatrain/Core`  
> **License**: AGPL-v3

---

## 🧭 1. Base Guidelines & Primary Hierarchy

All AI coding agents interacting with this workspace **MUST** strictly adhere to the author's primary development rules, GitFlow protocol, and 3-tier forking architecture defined in:
👉 **[AGENTS.okf Knowledge Base](https://github.com/crapougnax/AGENTS.okf)** — Start at [`content/index.md`](file:///Users/crapougnax/CODE/CRAPOUGNAX/AGENTS.okf/content/index.md)  
👉 **[Online Gist Reference](https://gist.github.com/crapougnax/47971b85aa73dd702f4372a89858111c)** (compiled router)

### Progressive Disclosure & Local OKF Repository
Quatrain Core embeds an authoritative architectural knowledge base adhering strictly to **OKF v0.1** under [`okf/`](okf/index.md).  
Before writing code or refactoring packages, agents **MUST** consult the matching concept fiche:

| Domain | Scope | Concept Fiches |
| :--- | :--- | :--- |
| **Domain Modeling** | Schemas, properties, FSM | [`okf/domain-modeling/`](okf/domain-modeling/index.md) (`core-base-object-and-properties.md`, `state-machines-and-workflows.md`) |
| **Persistence** | Repositories, SQL/NoSQL | [`okf/persistence-adapters/`](okf/persistence-adapters/index.md) (`quatrain-repository-pattern.md`, `database-adapters-setup.md`, `schema-and-data-migrations.md`) |
| **Auth & Security** | Providers, SSO, RBAC | [`okf/auth-and-security/`](okf/auth-and-security/index.md) (`auth-providers-and-sso.md`, `rbac-and-field-level-security.md`) |
| **Object Storage** | S3, MinIO, Local FS | [`okf/storage-and-assets/`](okf/storage-and-assets/index.md) (`unified-object-storage.md`) |
| **Queues & Events** | RabbitMQ, workers | [`okf/queues-and-events/`](okf/queues-and-events/index.md) (`asynchronous-event-streaming.md`) |
| **APIs & Gateways** | Fetch client, CrudEndpoint | [`okf/api-and-gateways/`](okf/api-and-gateways/index.md) (`isomorphic-api-client.md`, `api-server-and-endpoints.md`) |
| **AI & LLM** | Gemini models, JSON schemas | [`okf/ai-and-agents/`](okf/ai-and-agents/index.md) (`ai-gemini-and-skills.md`) |

---

## 🏗️ 2. Project-Specific Architecture & Guidelines

### A. Hexagonal Architecture & 7 Architectural Layers
Quatrain decouples business domain modeling from infrastructure across 71 packages:
1. **Domain & Entities (`@quatrain/core`)**: Pure domain models extending `BaseObject`. Zero external runtime dependencies.
2. **Databases & Persistence (`@quatrain/backend`)**: Persistent entities extending `PersistedBaseObject`, dynamic `Model.repository()`, and adapter registration via `Backend.addBackend(adapter, alias, setDefault)`.
3. **Authentication & RBAC (`@quatrain/auth`, `@quatrain/auth-rbac`)**: Identity abstraction (`Auth.addProvider()`) and granular Field-Level Security (`RbacPolicyEngine`, `sanitizeWrite`, `ExpressRbacMiddleware.handler()`).
4. **Object Storage (`@quatrain/storage`)**: Abstract object storage (`Storage.addStorage()`, `adapter.create(fileType, stream)`).
5. **Queues & Messaging (`@quatrain/queue`)**: Asynchronous worker queues (`Queue.addQueue()`, `adapter.send()`, `adapter.listen(topic, handler, { concurrency })`).
6. **APIs & Gateways (`@quatrain/api`, `@quatrain/api-client`, `@quatrain/api-server`)**: Isomorphic fetch client and higher-order controllers (`server.addEndpoint(CrudEndpoint(Model), path, options)`).
7. **AI & Cognitive (`@quatrain/ai`, `@quatrain/ai-gemini`)**: Official Google GenAI integration with schema-guaranteed JSON generation (`generateStructured`).

### B. Strict TypeScript & Code Quality Rules
- **No `as any` Type Bypasses**: Never use `as any`, `@ts-ignore`, or `@ts-nocheck` to silence TypeScript compiler errors. Always construct fully compliant, strongly-typed objects that satisfy interfaces.
- **Strongly-Typed Property Definitions**: Always use `.TYPE` constants (`StringProperty.TYPE`, `BooleanProperty.TYPE`, `NumberProperty.TYPE`) in `PROPS_DEFINITION`. Never use raw string literals (`'string'`, `'BooleanProperty'`).
- **Global Reflection Registration**: Always register model classes via `Core.addClass('ModelName', ModelName)` at the bottom of the file to resolve circular references.
- **Relational Property Naming**: Properties referencing other models must use **camelCase** matching the target class name, without `Id` or `_id` suffix (e.g. `user`, `studioModel`).

### C. Developer & Contributor Guide Paths
- **Building applications using Quatrain**: Follow [`okf/`](okf/index.md) and [`guidelines/AGENTS.md`](guidelines/AGENTS.md).
- **Contributing to the Quatrain Core monorepo**: Follow [`guidelines/CONTRIBUTING_AGENTS.md`](guidelines/CONTRIBUTING_AGENTS.md).

---

## 🛠️ 3. Essential Verification Commands

| Action | Command |
| :--- | :--- |
| **Run Unit Tests (all workspaces)** | `yarn test` |
| **Run Specific Workspace Test** | `yarn --cwd packages/<pkg-name> test` |
| **Build Documentation & TypeDoc** | `yarn docs:build` |
| **Start Nextra Documentation Server** | `yarn docs:dev` (accessible on `http://localhost:3000`) |
| **Typecheck Documentation Script** | `yarn ts-node scripts/build-docs.ts` |

---

## 🔄 4. GitFlow Protocol & Contributions

- **Active Integration Branch**: `develop`. All work branches off from `develop`.
- **Branch Naming**: `feat/<issue-id>-<description>` or `fix/<issue-id>-<description>` strictly from `develop`.
- **Conventional Commits**: Format `<type>(<scope>): <summary>` in International English (e.g. `feat(backend): add connection pool timeout`).
- **Pull Requests**: Target `--base develop` via `gh pr create`. Always link relevant issues.

---

## ⚡ 5. Tycho Package Orchestration (`tycho knowledge`)

Quatrain Core is packaged natively as a **Tycho Knowledge Package**:
- **Repository Manifest**: [`.tycho/repository.json`](.tycho/repository.json)
- **Knowledge Specification**: [`.tycho/knowledge/quatrain-core/package.json`](.tycho/knowledge/quatrain-core/package.json)
- **Post-Install Automation**: [`.tycho/knowledge/quatrain-core/post-install.sh`](.tycho/knowledge/quatrain-core/post-install.sh)

To annex this knowledge base into your local agent configuration (`AGENTS.okf`):
```bash
# 1. Register repository in Tycho
tycho repo add quatrain Quatrain/Core

# 2. Install knowledge package
tycho knowledge install quatrain/quatrain-core

# 3. Verify active packages
tycho knowledge list
```
The post-install script automatically links `okf/` into your active knowledge router and rebuilds agent configurations.
