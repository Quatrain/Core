# HOW-TO: Getting Started with `@quatrain/core-cli`

This guide explains how to leverage the `core` CLI to build and structure your Quatrain applications effortlessly.

## 1. Initializing a New Project

To start a new Quatrain project from scratch, use the `scaffold` command. This will generate a monorepo folder architecture ready to use.

```bash
npx @quatrain/core-cli scaffold MyProject
cd MyProject
yarn install
```

**What it does:**
- Creates a `package.json` for Yarn Workspaces.
- Sets up alias paths in `tsconfig.json`.
- Creates placeholder directories for `apps`, `packages`, `data`, and `config`.

## 2. Generating the Bootloader Configuration

The `@quatrain/app` bootloader requires a `quatrain.json` file to auto-instantiate the required adapters.

Run the interactive wizard from the root of your new project:

```bash
npx @quatrain/core-cli generate config
```

Answer the prompts to select your preferred Backend (e.g., PostgreSQL), Authentication (e.g., Supabase), Storage, and Queue systems.

**Resulting `quatrain.json`:**
The file will contain configurations mapping to environment variables:
```json
{
   "backend": {
      "adapter": "PostgresAdapter",
      "package": "@quatrain/backend-postgres",
      "config": {
         "host": "env(PG_HOST)",
         "port": "env(PG_PORT)"
      }
   }
}
```

## 3. Creating Migrations

To safely upgrade the database schema, generate migration files directly from the CLI.

```bash
npx @quatrain/core-cli generate migration initialize_users
```

This generates `migrations/20260427XXXXXX_initialize_users.ts`. Open this file and fill in the `up()` and `down()` functions using the Quatrain `Backend` singleton.

## 4. Local Development & Global CLI Setup

When developing or modifying the CLI locally, you can run and test the tool in several ways:

### A. Run on the Fly via Yarn Workspaces
From the root of the `Core` monorepo:
```bash
yarn workspace @quatrain/core-cli core <command>
# Example:
yarn workspace @quatrain/core-cli core deploy
```

### B. Setup a Global Command Alias (Recommended for Zsh)
To use the `core` command directly from any directory without installing it globally, add an alias to your Zsh configuration (`~/.zshrc`):
```bash
echo 'alias core="node /Users/crapougnax/CODE/QUATRAIN/Core/packages/core-cli/bin/core.js"' >> ~/.zshrc
source ~/.zshrc
```
You can then run:
```bash
core deploy
```

### C. Install Locally-Built Folder Globally via NPM
Alternatively, link the package to your global Node bin directory:
```bash
cd packages/core-cli
npm install -g .
```

> [!NOTE]
> When modifying TypeScript source files, make sure to compile them with `yarn build` or keep the compiler in watch mode with `yarn wbuild` inside the `packages/core-cli` directory.

## Documentation Guidelines

> **Recommendation**: Ensure that all logs, commit messages, console outputs, and code comments are written in **International English**. This convention aligns with the official Quatrain standard to support a globally distributed engineering team.
