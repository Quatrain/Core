# Application Composition & Ports/Adapters Guide (@quatrain/app)

This document provides a comprehensive guide on the **Hexagonal Application Composition Model** defined in `@quatrain/types` and orchestrated via `@quatrain/app`.

---

## 1. Architectural Philosophy

Quatrain applications strictly follow the **Hexagonal Architecture (Ports & Adapters)** design pattern:

- **The Deliverable Application Payload (`AppContentInterface`)**: Represents the user-facing application deliverable (such as a PWA, a Web Bundle, a CLI tool, or Native Assets). It is 100% agnostic to deployment topology.
- **Pivot Classes (`Ai`, `Backend`, `Storage`, `Auth`, `Queue`, `Messaging`)**: Central registries and lifecycle managers in Quatrain Core that can hold single or multiple named adapter instances.
- **Composition (`AppCompositionInterface`)**: A typed, isomorphic contract that glues a deliverable application payload with its runtime context of Quatrain infrastructure adapters.

Whether an application runs as a **Local Single-User App**, an **Offline Mobile App (Native WebView Shell)**, or a **Multi-Tenant Cloud SaaS**, the application core remains unchanged; only the context of bound infrastructure adapters changes.

---

## 2. Interface Definitions

All shared composition contracts reside in `@quatrain/types` to ensure isomorphic sharing across both frontend (browser/WebView) and backend (Node/Bun) environments with zero bundle bloat:

```typescript
import type { 
   AppCompositionInterface, 
   PWAContentInterface, 
   PivotAdaptersSpec, 
   AdapterConfigSpec 
} from '@quatrain/types';
```

### Key Interfaces

- **`AdapterConfigSpec`**: Specifies a single adapter package, class, and configuration options.
- **`PivotAdaptersSpec`**: Configures either a single default adapter or a map of named adapters for a pivot class (e.g. `ai.default`, `ai.transcription`).
- **`AppContentInterface`**: Base interface describing any deliverable payload (`pwa`, `web-bundle`, `cli`, `native`).
- **`PWAContentInterface`**: Specialized payload contract for Progressive Web Applications.
- **`AppCompositionInterface<TContent>`**: Isomorphic glue binding `TContent` with its pivot adapters and domain config.

---

## 3. Example 1: A Local-First Notes App

A local-first notes app exports its composition using `AppCompositionInterface<PWAContentInterface>`.

### A. Composition Specification

```typescript
// notes-app/src/composition.ts
import type { AppCompositionInterface, PWAContentInterface } from '@quatrain/types';

export const notesComposition: AppCompositionInterface<PWAContentInterface> = {
   content: {
      type: 'pwa',
      name: 'notes-app',
      version: '1.0.0',
      distPath: './dist',
      manifest: {
         name: 'Notes',
         short_name: 'Notes',
         theme_color: '#090d16',
         background_color: '#090d16'
      }
   },
   adapters: {
      // Pivot class Ai holding text generation and audio transcription
      ai: {
         default: { package: '@quatrain/ai-gemini', adapter: 'GeminiAdapter' },
         transcription: { package: '@quatrain/ai-whisper', adapter: 'WhisperAdapter' }
      },
      // Local SQLite backend for desktop/local deployment
      backend: { package: '@quatrain/backend-sqlite', adapter: 'SQLiteAdapter' },
      // Local disk storage for OKF documents
      storage: { package: '@quatrain/storage-local', adapter: 'LocalStorageAdapter' },
      // GitHub OAuth authentication provider
      auth: { package: '@quatrain/auth-github', adapter: 'GitHubAuthAdapter' }
   },
   config: {
      okfRoot: './data/content',
      defaultCategory: 'inbox'
   }
};
```

### B. Deployment Modalities

1. **Local Desktop / PWA Mode**: Bootstrapped via `AppBootloader.bootstrap()` with local disk storage and SQLite.
2. **Mobile App Mode**: Embedded inside an Expo React Native `WebView` shell. The mobile shell injects a native bridge adapter (`expo-sqlite`, `expo-audio`) into the composition context without changing the UI or domain code.

---

## 4. Example 2: A Multi-Tenant Cloud Assistant

The same engine, deployed as a multi-tenant cloud service with its own prompts, schemas and styling.

### A. Composition Specification

```typescript
// cloud-assistant/src/composition.ts
import type { AppCompositionInterface, PWAContentInterface } from '@quatrain/types';

export const assistantComposition: AppCompositionInterface<PWAContentInterface> = {
   content: {
      type: 'pwa',
      name: 'cloud-assistant',
      version: '1.0.0',
      distPath: './dist',
      theme: {
         primaryColor: '#1565c0',
         accentColor: '#64b5f6'
      },
      manifest: {
         name: 'Cloud Assistant',
         short_name: 'Assistant'
      }
   },
   adapters: {
      ai: {
         default: { package: '@quatrain/ai-gemini', adapter: 'GeminiAdapter' }
      },
      // Cloud PostgreSQL backend for tenant data
      backend: { package: '@quatrain/backend-postgres', adapter: 'PostgreSQLAdapter' },
      // Managed S3 bucket storage for documents and images
      storage: { package: '@quatrain/storage-s3', adapter: 'S3StorageAdapter' },
      // Supabase / OIDC authentication for enterprise tenants
      auth: { package: '@quatrain/auth-supabase', adapter: 'SupabaseAuthAdapter' }
   },
   config: {
      systemPromptPath: './prompts/rules.yaml'
   }
};
```

---

## 5. Bootstrapping a Composition

To bootstrap any composition at runtime, pass the configuration to `AppBootloader`:

```typescript
import { AppBootloader } from '@quatrain/app';
import { notesComposition } from './composition';

async function main() {
   // Bootstraps all declared adapters into Quatrain Core singletons
   await AppBootloader.bootstrapFromComposition(notesComposition);
   console.log('Application environment initialized successfully.');
}

main();
```

---

## 6. Summary of Architectural Benefits

- **Isomorphic Types**: Shared contracts reside in `@quatrain/types`, ensuring zero bundle weight overhead on client builds.
- **Multi-Adapter Support**: Pivot classes (`Ai`, `Storage`, etc.) can host multiple named adapters for specialized sub-tasks.
- **Total Decoupling**: Products remain pure PWA/Web deliverables; infrastructure modalities (Mobile, SaaS, Standalone) are simply contexts of adapters glued to the deliverable payload.
