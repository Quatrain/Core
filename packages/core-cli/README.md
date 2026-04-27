# @quatrain/core-cli

The official Command Line Interface (CLI) for the Quatrain ecosystem.
This CLI provides tools to scaffold projects, generate normalized bootloader configurations, and create migration files.

## Installation

You can install the CLI globally via NPM or Yarn, or run it on the fly using `npx` or `bunx`.

### Global Installation

```bash
npm install -g @quatrain/core-cli
# or
yarn global add @quatrain/core-cli
# or via Bun
bun add -g @quatrain/core-cli
```

### On-the-fly Execution

```bash
npx @quatrain/core-cli <command>
# or
bunx @quatrain/core-cli <command>
```

## Commands

### `core generate scaffold <project-name>`
Quickly initializes a new Quatrain project.
- Creates a base directory.
- Sets up the `apps/`, `data/`, `config/`, `packages/`, and `migrations/` folders.
- Generates a monorepo-ready `package.json` utilizing Yarn workspaces.
- Generates a `tsconfig.json` pre-configured with the required path mappings.

### `core generate config`
Starts an interactive wizard to generate a `quatrain.json` configuration file.
- Prompts for Backend, Auth, Queue, Storage, and Messaging adapters.
- Generates a normalized JSON configuration.
- The generated `env(...)` tokens will be resolved at runtime by the `AppBootloader`.

### `core generate migration <name>`
Scaffolds a new migration file.
- Creates a `migrations/` directory if it does not exist.
- Generates a timestamped TypeScript file (e.g., `20260427184500_init.ts`).
- Provides boilerplate `up()` and `down()` methods.

## Language Guidelines
> **Recommendation:** All text contents (such as console logs, commit messages, and comments) within the Quatrain ecosystem must be written in **International English**. This ensures accessibility and maintainability for developers worldwide.
