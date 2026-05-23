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

### H. Relational Properties Naming Convention

- **CRITICAL:** Properties that reference other models must be named exactly as the camelCase version of the model class name they reference, without any "Id" suffix.
- ✅ **GOOD:** `studioModel` (references `StudioModel`), `studioProject` (references `StudioProject`).
- ❌ **BAD:** `modelId`, `projectId`, `model`, `project`.

### I. DRY Principle (Don't Repeat Yourself)

- **CRITICAL:** Constantly look out for duplicate logic, scripts, or UI components.
- If you find yourself copying and pasting code (e.g., hash generation scripts in `bin/` or Mantine layout code in `studio-web`), you MUST extract it into a reusable function, class, or component.
- The monorepo aims for maximal factorisation to keep the codebase maintainable.

### J. Secure Process Execution (`shell: false`)

- **CRITICAL:** When using Node.js `child_process` methods (`spawn`, `exec`, `spawnSync`, etc.), you MUST explicitly disable the shell to prevent shell injection vulnerabilities.
- ❌ **BAD:** Using `exec('yarn build')` (uses a shell by default) or `spawn('docker', args, { shell: true })`.
- ✅ **GOOD:** Using `spawn('podman', ['compose', 'up'], { shell: false })` or `spawnSync('yarn', ['build'], { shell: false })`.
- If an external command relies heavily on shell features, find an equivalent cross-platform Node.js native API (e.g., using `fs.unlinkSync` instead of `rm -f`).

### K. Strict Type Declarations

- **CRITICAL:** Never declare a variable without an explicit type (or an implicitly strongly inferred type).
- "Jamais de déclaration sans type !" Declarations like `let target` without a type are strictly forbidden. They prevent TypeScript from correctly inferring types across `try/catch` blocks and lead to `TS18046` errors under strict configurations.
- ✅ **GOOD:** `let target: StudioTarget` or `let target: any` (if absolutely necessary to bypass the compiler).
- ❌ **BAD:** `let target`

### L. Test File Organization & NPM Publishing Cleanliness (for Bun/Deno)

- **CRITICAL:** To support native Bun and Deno environments, we deliver both the compiled `dist/` directory and the raw TypeScript source `src/` directory. However, we MUST prevent test files, mock data, and test configurations from bloating the published package bundle.
- **Co-locate unit tests:** Place unit tests (`*.test.ts` or `*.spec.ts`) directly next to their corresponding source files inside the `src/` directory (e.g., `src/MyService.test.ts`).
- **Group integration tests:** Place integration or system-wide functional tests in dedicated directories outside `src/` (such as `tests/` or `__tests__/` at the package root).
- **Exclude tests on publish:** Every package MUST explicitly exclude test-related files from its published NPM tarball.
  - In `package.json`, specify:
    ```json
    "files": [
      "dist",
      "src"
    ]
    ```
  - Ensure all package-level or root-level `.npmignore` files explicitly list exclusions:
    ```ignore
    **/*.test.ts
    **/*.test.js
    **/*.spec.ts
    **/*.spec.js
    **/__tests__/
    **/tests/
    **/mocks/
    jest.config.js
    tsconfig.tsbuildinfo
    ```
  - This guarantees ultra-lightweight published packages, prevents IDE autocomplete pollution for consumers, and avoids false flags during security audits of consumer applications.

### M. Code Quality & Linting Rules (SonarQube Compliance)

To satisfy modern code analyzers like SonarQube, always enforce the following code quality rules:
- **Explicit Conversion (`Number.parseInt`)**: Always prefer `Number.parseInt` over global `parseInt` for clarity and scope consistency.
- **Strict Checks (`Number.isNaN`)**: Always prefer `Number.isNaN` over global `isNaN` to avoid unexpected type coercion issues (e.g. `isNaN('abc')` returning `true`).
- **Interactive Elements & Accessibility (`typescript:S6848`)**:
  - Non-interactive DOM elements (e.g., `<div>`, `<span>`) should never have interactive event handlers (like `onClick` or `onKeyDown`) unless they are converted to appropriate native interactive elements (like `<button>`).
  - If a non-native interactive element must be used, add the appropriate WAI-ARIA `role`, a valid `tabIndex`, and corresponding tabbing, mouse, keyboard, and touch inputs.
- **Avoid Object Literal Default Parameters (`typescript:S7737`)**:
  - Never use an object literal as a default parameter value in function signatures (e.g. `params: object = {}`).
  - *Why*: Creating a new object reference on every invocation causes memory overhead, breaks React memoization, and is flagged by static code analyzers.
  - *The Fix*: Make the parameter optional (e.g., `params?: object`) or default to `undefined`, then initialize a fallback inside the function body (e.g. `const actualParams = params || {}`).

---

## 2. Monorepo & Production Workflow Skills

These skills define the expected workflow for modifying packages, managing dependencies, and compiling the app.

### A. Zero TypeScript Errors Policy
- A development task or feature is **NEVER** considered finished until the TypeScript compiler (`tsc`) passes without a single type error.
- **Do not ignore compiler errors.** If `yarn build` fails at the root, you must isolate and fix the underlying TypeScript errors before proceeding.
- **Unused Imports / Variables (TS6133):** You must strictly verify and remove any unused imports or variables before declaring a task complete. The TypeScript configuration considers these as errors, and they will block CI/CD pipelines.

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

### F. Package Documentation (README & HOWTO)
- **CRITICAL:** Every time a new package is created in the monorepo, it **MUST** include a comprehensive `README.md` file at its root.
- The README must clearly explain the purpose of the package, provide basic usage examples (HOWTO), and list any important technical details or conventions. This is mandatory for maintainability and community contributions.

---

## 3. Infrastructure & CI/CD Rigor

When writing or modifying build scripts, Dockerfiles, or GitHub Actions workflows, absolute rigor is mandatory. A modification must be holistically verified before declaring success.

### A. Holistic Variable & Dependency Validation
- **CRITICAL:** When modifying global scripts (e.g., `publish_all.js`, `build.js`), you MUST thoroughly test the script using `--build-only`, `--dry-run`, or by executing it locally in isolation. 
- You must carefully verify that NO undefined variables, obsolete paths, or scoping issues remain. If you rename a variable (like `packagesDir` to `workspacesDirs`), you must trace and replace EVERY instance of that variable across the entire script. Do not rely on blind search-and-replace.

### B. Workspace Context Awareness in Docker
- **CRITICAL:** When modifying `ContainerFile` or `Dockerfile`, you MUST explicitly determine the Docker Build Context expected by the CI pipeline (`context: .` vs `context: containers/my-app`). 
- Commands like `COPY src ./src` or `COPY package.json ./` will fatally fail if the context is misunderstood. You must cross-reference Dockerfiles with their corresponding `.github/workflows/*.yml` to ensure paths match perfectly.

### C. Registry Resolution & Workspaces
- **CRITICAL:** Remember that standard package managers (`npm`, `bun install`, `yarn`) cannot resolve `"workspace:*"` identifiers natively without the monorepo root context. 
- If a container is built in isolation (without copying the entire monorepo), its GitHub Action MUST contain a pre-build step to rewrite `package.json` dependencies from `"workspace:*"` to fixed registry versions (e.g., via `npm view`).
- You must verify that the packages required by the isolated container are actually published to the registry. If a container relies on private apps (e.g., `apps/studio-api`), those apps must be integrated into the publishing pipeline before isolated builds can succeed.

### D. Testing & Dry-Runs
- You must minimize CI trial-and-error. 
- Before committing infrastructure changes, emulate the CI locally where possible (e.g., dry-running publish scripts, verifying path resolutions, checking `tsconfig` rules).

### E. Proactive Extrapolation & Holistic Validation
- **CRITICAL:** As an AI agent, you must not be strictly reactive. If you uncover a systemic issue in one package (e.g., a missing dependency declaration that broke Turborepo's graph), you MUST proactively extrapolate that this error might exist elsewhere.
- You must write a script or use tools to audit the **entire monorepo** for similar omissions before considering your task complete. Do not wait for the developer to tell you to check the rest of the codebase.

### F. Defensive Programming in CI Scripts
- Shell scripts and Node.js build scripts must be highly defensive. Check for the existence of directories before calling `readdirSync`. Catch exceptions when manipulating file systems (e.g., `unlink` permissions errors) and provide clear debug output.
