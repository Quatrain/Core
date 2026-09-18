---
type: index
title: Quatrain Core — OKF Knowledge Base & Architecture Standards
description: Open Knowledge Format v0.1 knowledge base for Quatrain Core framework, domain modeling patterns, and backend adapters.
tags:
  - quatrain
  - architecture
  - okf
  - guidelines
  - tycho
timestamp: 2026-09-17T00:00:00.000Z
category: root
status: active
---

# Quatrain Core — OKF Knowledge Base & Architecture Standards

> **Format**: Open Knowledge Format (OKF v0.1) | **License**: AGPL-v3  
> **Source Repository**: `https://github.com/Quatrain/Core`  
> **Target Audience**: AI Coding Agents (Gemini, Claude, Antigravity, Cursor) & Human Engineers

---

## 🧭 1. Progressive Disclosure & Navigation

To maintain high agent velocity while preserving context tokens, do not load all fiches simultaneously. Navigate hierarchically starting from the categories below:

| Thematic Category | Coverage & Scope | Category Index |
| :--- | :--- | :--- |
| **Domain Modeling & Entities** | Declarative schemas, typed properties, proxy access (`._`), FSM workflows | [domain-modeling/index.md](domain-modeling/index.md) |
| **Persistence & Database Adapters** | Active Record, repository pattern, PostgreSQL, SQLite, Firestore, migrations | [persistence-adapters/index.md](persistence-adapters/index.md) |
| **Authentication & Access Control** | Multi-provider auth (Supabase, Firebase, OIDC), RBAC & Field-Level Security | [auth-and-security/index.md](auth-and-security/index.md) |
| **Storage & Object Assets** | Unified storage abstraction (S3/MinIO, Local FS, Firebase Storage) | [storage-and-assets/index.md](storage-and-assets/index.md) |
| **Queues & Event Streaming** | Asynchronous workers, AMQP/RabbitMQ, MQTT, SQLite queue, AWS SQS | [queues-and-events/index.md](queues-and-events/index.md) |
| **API Clients & Server Endpoints** | Isomorphic fetch client, retry backoff, Express/Astro server controllers | [api-and-gateways/index.md](api-and-gateways/index.md) |
| **AI Agents & LLM Integration** | Gemini engine adapter, conversational memory, skill execution | [ai-and-agents/index.md](ai-and-agents/index.md) |

---

## ⚡ 2. Tycho Annexation Protocol (`tycho knowledge`)

This knowledge base is packaged as an official **Tycho Knowledge Package**. It can be directly installed and annexed to your active AI agent environment (`AGENTS.okf`, `.gemini/config`, or project-level rules) using the **Tycho CLI**.

### Step 1: Register Repository (if not already present)
```bash
tycho repo add quatrain Quatrain/Core
```

### Step 2: Install Knowledge Package
```bash
tycho knowledge install quatrain/quatrain-core
```
*(Or `tycho knowledge install quatrain-core` if auto-search is enabled across registered repos).*

### Step 3: Verify Active Installation
```bash
tycho knowledge list
```

The post-install hook automatically links `okf/` into your active knowledge base (e.g. `~/.tycho/knowledge/agents-okf/content/quatrain-core` or local workspace `AGENTS.okf`) and rebuilds LLM agent routers.

---

## 🛑 3. Mandatory Framework Coding Rules

1. **Zero `as any` Type Assertions**: Never use `as any`, `@ts-ignore`, or loose type assertions. Use explicit interfaces and Quatrain type constants.
2. **Schema Authority**: Entities must declare properties via `Core.addClass()` with `.TYPE` definitions from `@quatrain/core`.
3. **Repository Decoupling**: Business domain objects must never directly query raw SQL or drivers; always route queries through the registered repository adapter.
