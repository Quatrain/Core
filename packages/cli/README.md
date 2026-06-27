# @quatrain/cli

The official Command Line Interface (CLI) and script utility library for the Quatrain ecosystem. 

This package serves two distinct purposes:
1. **Programmatic Utilities (Library API):** Exported classes and prompt helpers to build interactive scripts and run system subprocesses (e.g. within agent skills).
2. **Core Command-Line Executable (`core`):** A global terminal command runner to scaffold projects, generate configurations, and manage deployments.

---

## 1. Programmatic Utilities (Library API)

Import these utilities directly in your TypeScript/JavaScript scripts to interact with the user or run external processes.

### A. Fluent Command Executor (`Command`)

The `Command` class provides a cross-platform, fluent builder-pattern interface to execute system subprocesses. It simplifies spawning commands, passing arguments, setting working directories, extending environment variables, and supports PowerShell routing.

```typescript
import { Command } from '@quatrain/cli';

const result = await Command.create('kubectl')
  .arg('apply')
  .arg('-f')
  .arg('deployment.yaml')
  .cwd('/path/to/project')
  .env({ KUBECONFIG: '/path/to/config' })
  .execute();

if (result.success) {
  console.log(`Success: ${result.stdout}`);
} else {
  console.error(`Exit code: ${result.code}, Error: ${result.stderr}`);
}
```

**Fluent Methods:**
- `Command.create(bin)` / `new Command(bin)`: Start building a command for the given binary.
- `.arg(value)` / `.args([values])`: Append command-line arguments.
- `.cwd(dir)`: Set the execution working directory.
- `.env({ KEY: VALUE })`: Set or extend environment variables.
- `.inherit()`: Direct stdout and stderr to the parent process terminal.
- `.usePowerShell(use, type)`: Force process execution through PowerShell (`powershell.exe` or `pwsh`) with safe quote escaping.
- `.execute()`: Run the process asynchronously and return `{ stdout, stderr, code, success }`.

### B. Interactive Prompt Helpers

Helpers wrapping `inquirer` to prompt user inputs cleanly:

```typescript
import { askConfirm, askInput, askChoice } from '@quatrain/cli';

// Yes/No Confirmations
const proceed = await askConfirm('Do you want to deploy now?');

// String Inputs
const name = await askInput('Enter your username:', 'default_user');

// Multi-choice select lists
const selected = await askChoice('Select action:', [
  { name: 'Sync Google Calendar', value: 'sync' },
  { name: 'Reset Database', value: 'reset' }
]);
```

---

## 2. Core Command-Line Executable

A global CLI tool invoked via the `core` command (or `quatrain` depending on symlinks).

### Installation

Install globally or run on-the-fly:

```bash
# Global
bun add -g @quatrain/cli

# Run on the fly
bunx @quatrain/cli <command>
```

### Commands Reference

#### `core deploy`
Manage Kubernetes deployments (create, list, modify, promote, delete namespaces and manifests).

#### `core generate scaffold <project-name>`
Initialize a new Quatrain project structure:
- Sets up directories: `apps/`, `data/`, `config/`, `packages/`, `migrations/`.
- Generates a monorepo-ready workspace `package.json` and a pre-configured `tsconfig.json`.

#### `core generate config`
Start an interactive wizard to generate the `quatrain.json` bootloader configuration file.

#### `core generate migration <name>`
Scaffold a timestamped TypeScript migration file (e.g., `migrations/20260427_name.ts`) with template `up()` and `down()` blocks.

---

## Language Guidelines
> **Recommendation:** All text contents (logs, console prints, commit messages, comments) within the Quatrain ecosystem must be written in **International English** to ensure global team maintainability.
