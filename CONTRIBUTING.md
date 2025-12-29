# Contributing to Quatrain Core

First off, thank you for considering contributing to Quatrain Core! It's people like you who make this modular BaaS framework a great tool for the developer community.

## ⚖️ License Agreement

As of January 1st, 2026, Quatrain Core has transitioned from the MIT License to the **GNU Affero General Public License v3.0 (AGPL-3.0-only)**.

**By contributing to this project, you agree that:**

1. Your contributions will be licensed under the AGPL-3.0-only.
2. You represent that you have the right to license your contribution under these terms.
3. You acknowledge that Quatrain Technologies remains the copyright holder and may offer commercial licenses for the software to organizations requiring non-copyleft terms.

We chose the AGPL to ensure that improvements made to the framework—even when used as a network service—are shared back with the community. For more details, please see our [LICENSE.md](./LICENSE.md).

## 🚀 How Can I Contribute?

### Reporting Bugs

-  Use the GitHub Issue Tracker.
-  Describe the bug, provide steps to reproduce, and include environment details (Node version, OS, etc.).

### Suggesting Enhancements

-  Open an issue to discuss the feature before implementation.
-  Explain why the enhancement would be useful to the broader Quatrain ecosystem.

### Pull Requests

1. **Fork the repo** and create your branch from `main`.
2. **Install dependencies** using `yarn install`.
3. **Write your code**. Ensure you follow the existing TypeScript patterns and modular structure.
4. **Add tests**. We use Jest for testing. Ensure your changes don't break existing functionality by running `yarn test` in the relevant package.
5. **Update documentation**. If you change an API or add a feature, update the relevant `README.md` within the package.
6. **Submit the PR**. Provide a clear description of the changes.

## 🛠️ Development Workflow

Quatrain Core is a monorepo managed with Yarn workspaces.

-  **Building**: Run `yarn build` from the root or within a specific package.
-  **Testing**: Run `yarn test-ci` to run tests across all packages.
-  **Linting**: Ensure your code follows the project's TypeScript configuration.

## 📝 Coding Standards

-  **TypeScript**: All code must be written in TypeScript.
-  **Modular Design**: Keep adapters decoupled from the core logic.
-  **Clean Code**: Use descriptive variable names and keep functions focused.

## 📞 Questions?

If you have questions about the license change or technical implementation, feel free to open a discussion or contact the maintainers at `developers@quatrain.com`.

---

_Copyright © 2024-2026 Quatrain Technologies. All Rights Reserved._
