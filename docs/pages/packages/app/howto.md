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

## 3. Real-World Case Study 1: Modaka (Second Brain Copilot)

**Modaka** is a local-first personal knowledge copilot. It exports its composition using `AppCompositionInterface<PWAContentInterface>`.

### A. Composition Specification

```typescript
// modaka/src/composition.ts
import type { AppCompositionInterface, PWAContentInterface } from '@quatrain/types';

export const modakaComposition: AppCompositionInterface<PWAContentInterface> = {
   content: {
      type: 'pwa',
      name: 'modaka',
      version: '1.0.0',
      distPath: './dist',
      manifest: {
         name: 'Modaka Second Brain',
         short_name: 'Modaka',
         theme_color: '#090d16',
         background_color: '#090d16'
      }
   },
   adapters: {
      // Pivot class Ai holding Gemini text generation and Whisper audio transcription
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
      okfRoot: './second-brain-data/content',
      defaultCategory: 'inbox'
   }
};
```

### B. Deployment Modalities for Modaka

1. **Local Desktop / PWA Mode**: Bootstrapped via `AppBootloader.bootstrap()` with local disk storage and SQLite.
2. **Mobile App Mode (`modaka-app`)**: Embedded inside an Expo React Native `WebView` shell. The mobile shell injects a native bridge adapter (`expo-sqlite`, `expo-audio`) into the composition context without changing Modaka's UI or domain code.

---

## 4. Real-World Case Study 2: Hey Brad (Agronomic AI Companion)

**Hey Brad** is a verticalized domain application built for the agricultural sector. It extends the knowledge engine by injecting agricultural system prompts, domain-specific schemas, and agricultural UI styling while connecting to cloud multi-tenant adapters.

### A. Composition Specification

```typescript
// hey-brad/src/composition.ts
import type { AppCompositionInterface, PWAContentInterface } from '@quatrain/types';

export const heyBradComposition: AppCompositionInterface<PWAContentInterface> = {
   content: {
      type: 'pwa',
      name: 'hey-brad',
      version: '1.0.0',
      distPath: './dist',
      theme: {
         primaryColor: '#2e7d32', // Agronomic green
         accentColor: '#81c784'
      },
      manifest: {
         name: 'Hey Brad — Agricultural AI Companion',
         short_name: 'HeyBrad'
      }
   },
   adapters: {
      // Multi-tenant Cloud AI configuration
      ai: {
         default: { package: '@quatrain/ai-gemini', adapter: 'GeminiAdapter' }
      },
      // Cloud PostgreSQL backend for tenant data
      backend: { package: '@quatrain/backend-postgres', adapter: 'PostgreSQLAdapter' },
      // Managed S3 bucket storage for farm documents and images
      storage: { package: '@quatrain/storage-s3', adapter: 'S3StorageAdapter' },
      // Supabase / OIDC authentication for agricultural enterprise tenants
      auth: { package: '@quatrain/auth-supabase', adapter: 'SupabaseAuthAdapter' }
   },
   config: {
      domain: 'agronomy',
      systemPromptPath: './prompts/agronomic-rules.yaml',
      supportedCrops: ['wheat', 'corn', 'vineyard', 'fruit-trees']
   }
};
```

---

## 5. Bootstrapping a Composition

To bootstrap any composition at runtime, pass the configuration to `AppBootloader`:

```typescript
import { AppBootloader } from '@quatrain/app';
import { modakaComposition } from './composition';

async function main() {
   // Bootstraps all declared adapters into Quatrain Core singletons
   await AppBootloader.bootstrapFromComposition(modakaComposition);
   console.log('Application environment initialized successfully.');
}

main();
```

---

## 6. Summary of Architectural Benefits

- **Isomorphic Types**: Shared contracts reside in `@quatrain/types`, ensuring zero bundle weight overhead on client builds.
- **Multi-Adapter Support**: Pivot classes (`Ai`, `Storage`, etc.) can host multiple named adapters for specialized sub-tasks.
- **Total Decoupling**: Products (`modaka`, `hey-brad`) remain pure PWA/Web deliverables; infrastructure modalities (Mobile, SaaS, Standalone) are simply contexts of adapters glued to the deliverable payload.
