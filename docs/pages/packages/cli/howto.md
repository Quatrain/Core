# HOW-TO: Getting Started with `@quatrain/cli`

This guide explains how to leverage both the programmatic library utilities and the command line commands of `@quatrain/cli`.

---

## 1. Scripting & Custom CLI Tools (Programmatic Usage)

Use the exported APIs of `@quatrain/cli` to build custom runner scripts, sync actions, and integration workflows.

### A. Spawning Subprocesses with `Command`
To execute external commands securely and retrieve their logs:

```typescript
import { Command } from '@quatrain/cli';

async function listKubectlNamespaces() {
  const result = await Command.create('kubectl')
    .args(['get', 'namespaces', '-o', 'json'])
    .execute();

  if (!result.success) {
    throw new Error(`Failed to list namespaces: ${result.stderr}`);
  }

  return JSON.parse(result.stdout);
}
```

### B. Requesting User Validation
Ask for confirmations or inputs interactively in your CLI actions:

```typescript
import { askConfirm, askInput } from '@quatrain/cli';

const cleanDb = await askConfirm('Reset database before starting?', false);
if (cleanDb) {
  const dbName = await askInput('Specify DB name to reset:', 'quatrain_dev');
  // ... run reset
}
```

---

## 2. Using the Global CLI Tool (`core`)

The package exposes a `core` binary to scaffold files and deploy infrastructures.

### A. Initializing a New Project
```bash
npx @quatrain/cli generate scaffold MyNewProject
cd MyNewProject
bun install
```
Creates folder directories (`apps/`, `packages/`, etc.) and sets up monorepo packages and `tsconfig.json`.

### B. Generating Configurations
```bash
npx @quatrain/cli generate config
```
Walks through an interactive wizard to configure PostgreSQL, Redis, Queues, and outputs a resolved `quatrain.json`.

### C. Creating Migrations
```bash
npx @quatrain/cli generate migration add_profile_fields
```
Scaffolds timestamped files under `migrations/` containing migration templates.

### D. Managing Deployments
```bash
npx @quatrain/cli deploy
```

---

## 3. Local Development & CLI Linking

When making local changes to `@quatrain/cli` in the `Core` monorepo:

### Running core commands on-the-fly:
```bash
# From the root of the Core monorepo
yarn workspace @quatrain/cli core deploy
```

### Compiling changes:
Make sure to re-compile TypeScript code when editing `src/` files:
```bash
cd packages/cli
yarn build
# Or watch mode:
yarn wbuild
```

---

## Documentation Guidelines
> **Recommendation:** Ensure all console outputs, instructions, logging, and codebase comments are written in **International English** to meet Quatrain standards.
