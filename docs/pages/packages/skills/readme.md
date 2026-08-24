# @quatrain/skills

Shared TypeScript CLI and API client helper utilities for building and running Quatrain Agent skills.

## Features

- **Robust File Writing**: Includes `writeOutput` which safely creates parent directories (such as `.log/` or subfolders) when saving results.
- **Typed Schemas**: Exports TypeScript interfaces for declaring API-based skills (`ApiSkillDefinition`), remote method registries (`RemoteMethodDefinition`), and client configs (`SkillApiClientConfig`).
- **Standardized Logging**: Reuses Quatrain Core's base logger to write consistent logs.

---

## Getting Started

Refer to `HOWTO.md` for guidelines and usage.

## License

AGPL-3.0-only
