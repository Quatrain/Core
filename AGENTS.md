# Quatrain Core - Agent & Developer Workflow Guidelines

This document serves as the central set of skills and recommendations for AI agents (like Gemini, Cursor, Copilot) and developers working on the Quatrain Core monorepo.

**When working on this repository, you MUST adhere to the following rules and best practices.**

---

## 1. Architectural Guidelines

These are the core architectural rules translated from our historical guidelines. Always respect them when interacting with Quatrain's APIs.

### A. Instantiating and Loading Models (`PersistedBaseObject`)

You must clearly distinguish between creating a new object and loading an existing one from the database.

- ✅ **`.fromBackend(id)` is the standard for loading an existing object.**
  ```typescript
  // ✅ GOOD: Load an existing user from the database
  const existingUser = await User.fromBackend('123e4567-e89b-12d3-a456-426614174000')
  ```

- ✅ **`.factory()` can be used to instantiate new objects or load by ID.**
  Thanks to recent updates, passing a raw UUID to `.factory(id)` will now automatically prefix the class's collection name and correctly resolve the URI.
  ```typescript
  // ✅ GOOD: Create a new instance (empty or with initial data)
  const newUser = await User.factory({ email: 'test@test.com' })
  
  // ✅ GOOD: Load by ID (resolves to "users/123e4567-e89b-12d3-a456-426614174000")
  const user = await User.factory('123e4567-e89b-12d3-a456-426614174000')
  ```

### B. Defining Properties (`PROPS_DEFINITION`)

When defining model structures via `PROPS_DEFINITION`, you must use the framework's static `.TYPE` properties, never string literals.

- ❌ **DO NOT use string literals for property types.**
  ```typescript
  // ❌ BAD: Causes "Unknown property type" error
  export const MyModelDef = [
     { name: 'isDefault', type: 'BooleanProperty' } // ❌ String literal
  ]
  ```

- ✅ **DO use the `.TYPE` constant from the imported property class.**
  ```typescript
  import { BooleanProperty } from '@quatrain/core'
  
  // ✅ GOOD: Strongly typed
  export const MyModelDef = [
     { name: 'isDefault', type: BooleanProperty.TYPE }
  ]
  ```

### C. Handling Soft Deletes

By default, Quatrain uses a "soft delete" system via the `status` property inherited from `BaseObject`.
- Calling `.delete()` on an object where `softDelete: true` is configured in the backend adapter will simply set `status = 'deleted'`.
- **CRITICAL:** When running raw queries (e.g., via `apiClient.get()` or backend filters), you MUST explicitly filter out deleted items unless the middleware handles it for you.
  ```typescript
  // Always filter out soft-deleted items explicitly
  const result = await Backend.execute(Model, 'read', { filters: { 'status:neq': 'deleted' } })
  ```

### D. Logging Guidelines

- ❌ **`Backend.log()` is DEPRECATED.** Do not use it.
- ✅ **Use specific severity levels:**
  - `Backend.debug('...')`: For technical debugging and fine-grained traceability.
  - `Backend.info('...')`: For normal system events (e.g., "Server started").
  - `Backend.warn('...')`: For abnormal but non-blocking situations.
  - `Backend.error('...')`: For critical errors and captured exceptions.
- **Language Rule:** All log messages, code comments, and developer-facing textual content MUST be written in **international English**.

### E. Documenting New Classes, Functions & Methods (JSDoc)

- **CRITICAL:** Systematically, at **every iteration**, any time an AI agent or a developer adds a new class, standalone function, or method, it **MUST** be accompanied by a comprehensive JSDoc block.
- The documentation block must explain what the entity does, list its `@param` arguments with descriptions, and define its `@returns` value (if applicable).
- Do not forget this step. It is mandatory for every single new implementation to ensure the codebase remains self-documenting and accessible for both human developers and AI assistants.

### F. Class Encapsulation (Protected vs Private)

- **CRITICAL:** Prefer using `protected` instead of `private` for class properties and methods.
- This allows classes to be easily extended via inheritance unless the class is explicitly marked as `final`.

### G. API Endpoints (PATCH vs PUT)

- **CRITICAL:** Always prefer `PATCH` over `PUT` when updating objects via API endpoints.
- `PATCH` optimizes processing, especially since Quatrain's models track modified properties using a `hasChanged` flag, allowing only the modified properties to be pushed and processed.

---

## 2. Monorepo & Production Workflow Skills

These skills define the expected workflow for modifying packages, managing dependencies, and compiling the app.

### A. Zero TypeScript Errors Policy
- A development task or feature is **NEVER** considered finished until the TypeScript compiler (`tsc`) passes without a single type error.
- **Do not ignore compiler errors.** If `yarn build` fails at the root, you must isolate and fix the underlying TypeScript errors before proceeding.

### B. Local Package Compilation Checks
- Because root-level builds can fail or become noisy, always verify your types locally inside the modified package.
- Run `npx tsc -p tsconfig.json` directly within the package directory (e.g., `cd packages/api-server && npx tsc -p tsconfig.json`).
- *Note:* In restricted sandbox environments, you may encounter `EPERM` errors when writing to the `dist/` folder or `tsbuildinfo`. You can safely ignore `EPERM` write errors **as long as there are ZERO syntax or type-checking errors (e.g., TS2345, TS2554, etc.)**.

### C. Workspace Dependencies (`workspace:*`)
- The Quatrain monorepo uses Yarn/Turbo workspaces. 
- When a package depends on another internal package (e.g., `@quatrain/api` depending on `@quatrain/core`), the dependency version in `package.json` **MUST** be declared as `"workspace:*"`.
- This ensures the build tools establish the correct topological order during `yarn build`.

### D. TypeScript Configuration & `rootDir` Isolation
- The monorepo shares a root `tsconfig.json`, but local packages must override certain paths to prevent compiler leakage.
- If you encounter a `TS6059: File is not under 'rootDir'` error pointing to a file in another package, it means the local package is attempting to compile external source files.
- **The Fix:** Ensure the local package's `tsconfig.json` contains an empty `paths` object to override the root configuration:
  ```json
  "compilerOptions": {
     "rootDir": "src",
     "outDir": "dist",
     "paths": {}
  }
  ```

### E. Package.json & NPM Provenance
- The Quatrain monorepo uses NPM Provenance in GitHub Actions for secure releases.
- **CRITICAL:** Whenever a new package is created, its `package.json` MUST contain a valid `repository` block. If this is missing, the release pipeline will fail with a 422 Unprocessable Entity error during publication.
- Example of a required `repository` block:
  ```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Quatrain/Core.git",
    "directory": "packages/<package-name>"
  }
  ```
