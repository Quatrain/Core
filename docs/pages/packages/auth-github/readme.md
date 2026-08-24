# @quatrain/auth-github

Authentication adapter and pluggable endpoints for GitHub OAuth 2.0 Web Application Flow.

## Installation

This package is a workspace package within the Quatrain Core monorepo. It depends on `@quatrain/auth` and `@quatrain/api`.

```bash
yarn add @quatrain/auth-github
```

## Features

- **OAuth 2.0 Flow**: Handles authorization URL generation and exchanging code for token.
- **Pluggable API Router**: Framework-agnostic `GithubAuthApi` endpoint handler matching `ServerAdapter` specification.
- **Deep Linking**: Supports generic redirect schemes for mobile contexts.
- **GitHub API Utilities**: Methods to check repository existence and create new repositories.
